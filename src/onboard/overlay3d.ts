// The 3D elements of the interview's 2D form layer: a transparent WebGL layer above the form that draws live 3D
// models standing on the paper (each in its own window, with a soft contact shadow, gently alive, sliding forward
// when chosen), and the 3D things that move over the paper in screen space: the floating fountain pen (a persistent
// actor drawn with a perspective camera, so it tilts and foreshortens like a real pen), the rubber stamp, a cassette
// flying into the recorder. It renders at half the form's pixel scale, so the models are crisp pixel art a step finer
// than the painted paper.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SlotOpts {
  /** sway speed (0: still) */
  spin?: number; pitch?: number; zoom?: number; yaw?: number; lift?: number; box?: boolean;
  /**
   * 'h' (the default for answer objects): the model's projected height fills a common share of its window, so a
   * little espresso cup reads as large as a tall can; a wide model is limited by the window's width instead
   */
  fit?: 'h';
  /** sway amplitude in radians (0.5) */
  sway?: number;
  /** a soft contact shadow under the model (true) */
  shadow?: boolean;
  focus?: { c: THREE.Vector3; r: number };
  tick?: (o: THREE.Object3D, t: number, dt: number) => void;
}
export type SlotState = 'off' | 'on' | 'back';
interface Slot { el: HTMLElement; obj: THREE.Object3D; cam: THREE.PerspectiveCamera; r: number; c: THREE.Vector3; bw: number; bd: number; bh: number; o: SlotOpts; sel: number; selV: number; born: number; home: THREE.Vector3; fits: number; fwd: number; want: number; hidden: boolean; shadow: THREE.Mesh | null; rect: { x: number; y: number; w: number; h: number } }
interface Moment { obj: THREE.Object3D; t: number; dur: number; f: (k: number, o: THREE.Object3D) => void; done?: () => void; persp: boolean }
interface Actor { obj: THREE.Object3D; f: (dt: number, t: number) => void }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

let shadowTex: THREE.Texture | null = null;
/** a soft round contact shadow, dithered at its edge (pixel art, not a smooth gradient) */
function shadowMap() {
  if (shadowTex) return shadowTex;
  const n = 32, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!, img = g.createImageData(n, n);
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot((x + 0.5 - n / 2) / (n / 2), (y + 0.5 - n / 2) / (n / 2));
    const a = Math.max(0, 1 - d) ** 1.4;
    const q = Math.floor(a * 6 + (B[(y & 3) * 4 + (x & 3)] / 16 - 0.5)) / 6;
    img.data.set([20, 10, 4, Math.max(0, Math.min(1, q)) * 255], (y * n + x) * 4);
  }
  g.putImageData(img, 0, 0);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.magFilter = THREE.NearestFilter; shadowTex.minFilter = THREE.LinearFilter; shadowTex.generateMipmaps = false;
  return shadowTex;
}
/** A model's bounding box, leaving out decorative effects (steam, glows) marked userData.noFit. */
export function boxOf(o: THREE.Object3D): THREE.Box3 {
  const b = new THREE.Box3(), tmp = new THREE.Box3();
  o.updateWorldMatrix(true, true);
  const walk = (n: THREE.Object3D) => {
    if (n.userData.noFit) return;
    const m = n as THREE.Mesh;
    if (m.isMesh && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld); b.union(tmp); }
    for (const c of n.children) walk(c);
  };
  walk(o);
  return b;
}
export function softShadow(opacity = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowMap(), transparent: true, depthWrite: false, opacity, toneMapped: false }));
  m.renderOrder = -1;
  return m;
}

export class Overlay3D {
  readonly canvas = document.createElement('canvas');
  private R: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private slots = new Map<string, Slot>();
  private moments: Moment[] = [];
  private actors = new Set<Actor>();
  private screen = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  /** a perspective camera over the screen: the plane z = 0 maps 1:1 to CSS px (x right, y up = -CSS y) */
  readonly persp = new THREE.PerspectiveCamera(24, 1, 10, 20000);
  private t = 0;
  private n = 0;
  /** CSS px per pixel of this layer (the form's pixel scale) */
  k = 2;
  private w = 1; private h = 1;
  /** time scale of the moments (1; the dev harness slows them down to look at them) */
  pace = 1;
  /** hold every moment at this point of its play (dev harness), or null */
  freeze: number | null = null;
  exposure = 1.05;
  /** CSS px per pixel actually drawn: half the form's pixel, so small models stay legible (never below 1) */
  private get q() { return Math.max(1, Math.round(this.k / 2)); }

  constructor() {
    const c = this.canvas;
    Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '46', imageRendering: 'pixelated' });
    this.R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: false, premultipliedAlpha: true });
    this.R.setPixelRatio(1);
    this.R.outputColorSpace = THREE.SRGBColorSpace;
    this.R.toneMapping = THREE.ACESFilmicToneMapping;
    this.R.toneMappingExposure = this.exposure;
    this.R.setClearColor(0x000000, 0);
    this.R.autoClear = false;
    try { this.scene.environment = new THREE.PMREMGenerator(this.R).fromScene(new RoomEnvironment(), 0.04).texture; (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.55; } catch { /* plain lights */ }
    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2414, 1.15));
    const key = new THREE.DirectionalLight(0xffe0b0, 2.5); key.position.set(-2, 4, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.8); rim.position.set(3, 2, -3); this.scene.add(rim);
    document.body.appendChild(c);
    this.resize();
  }

  resize() {
    this.w = Math.max(16, Math.ceil(innerWidth / this.q)); this.h = Math.max(16, Math.ceil(innerHeight / this.q));
    this.R.setSize(this.w, this.h, false);
    // a screen-space camera in CSS px (x right, y down)
    Object.assign(this.screen, { left: 0, right: innerWidth, top: 0, bottom: -innerHeight });
    this.screen.updateProjectionMatrix();
    const P = this.persp, D = innerHeight / 2 / Math.tan((P.fov * Math.PI) / 360);
    P.aspect = innerWidth / innerHeight;
    P.position.set(innerWidth / 2, -innerHeight / 2, D);
    P.near = D * 0.2; P.far = D * 3;
    P.lookAt(innerWidth / 2, -innerHeight / 2, 0);
    P.updateProjectionMatrix();
  }
  setScale(k: number) { if (k !== this.k) { this.k = k; this.resize(); } }

  /** Put a model in a window (the element's box). The model is fitted and framed in a three-quarter view. */
  setSlot(id: string, el: HTMLElement, obj: THREE.Object3D, o: SlotOpts = {}) {
    this.removeSlot(id);
    const home = V(this.n++ * 50, 0, 0);
    obj.position.add(home);
    this.scene.add(obj);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 200);
    const shadow = o.shadow === false ? null : softShadow(0.55);
    if (shadow) { shadow.rotation.x = -Math.PI / 2; this.scene.add(shadow); }
    const s: Slot = { el, obj, cam, r: 0, c: home.clone(), bw: 0, bd: 0, bh: 0, o, sel: 0, selV: 0, born: this.t, home, fits: 0, fwd: 0, want: 0, hidden: false, shadow, rect: { x: 0, y: 0, w: 0, h: 0 } };
    this.fit(s);
    this.slots.set(id, s);
  }
  /** frame the model (again: models that load late, like the owls, are refitted for their first frames) */
  private fit(s: Slot) {
    if (s.o.focus) { s.c.copy(s.home).add(s.o.focus.c); s.r = s.o.focus.r; return; }
    const rot = s.obj.rotation.y, sc = s.obj.scale.x, py = s.obj.position.y, pz = s.obj.position.z;
    s.obj.rotation.y = 0; s.obj.scale.setScalar(1); s.obj.position.y = s.home.y; s.obj.position.z = s.home.z;
    s.obj.updateMatrixWorld(true);
    const box = boxOf(s.obj);
    s.obj.rotation.y = rot; s.obj.scale.setScalar(sc); s.obj.position.y = py; s.obj.position.z = pz;
    if (box.isEmpty()) return;
    const sph = box.getBoundingSphere(new THREE.Sphere()), sz = box.getSize(V(0, 0, 0));
    s.r = sph.radius; s.c.copy(sph.center); s.bw = Math.max(sz.x, sz.z); s.bd = Math.min(sz.x, sz.z); s.bh = sz.y;
  }
  removeSlot(id: string) { const s = this.slots.get(id); if (!s) return; this.scene.remove(s.obj); if (s.shadow) this.scene.remove(s.shadow); this.slots.delete(id); }
  clearSlots() { for (const id of [...this.slots.keys()]) this.removeSlot(id); }
  has(id: string) { return this.slots.has(id); }
  /** a little hop when picked */
  pick(id: string) { const s = this.slots.get(id); if (s) s.selV += 5; }
  /** chosen (slides forward), not chosen (steps back, a little darker) or neutral */
  setState(id: string, st: SlotState) { const s = this.slots.get(id); if (s) s.want = st === 'on' ? 1 : st === 'back' ? -1 : 0; }
  /** hide a slot's model (it is flying somewhere else for a moment) */
  hide(id: string, on: boolean) { const s = this.slots.get(id); if (s) s.hidden = on; }
  /** where a point given in the slot model's own space lands on screen (CSS px), and how many CSS px a metre there is */
  project(id: string, local: THREE.Vector3): { x: number; y: number; ppm: number } | null {
    const s = this.slots.get(id);
    if (!s || !s.rect.w) return null;
    s.obj.updateMatrixWorld(true);
    const wp = local.clone().applyMatrix4(s.obj.matrixWorld), p = wp.clone().project(s.cam);
    const dist = s.cam.position.distanceTo(wp), tv = Math.tan((s.cam.fov * Math.PI) / 360);
    const ppm = (s.rect.h / 2) / (dist * tv) * s.obj.scale.x;
    return { x: s.rect.x + (p.x * 0.5 + 0.5) * s.rect.w, y: s.rect.y + (-p.y * 0.5 + 0.5) * s.rect.h, ppm };
  }

  /** where a world point seen by a slot's camera lands on screen (CSS px) */
  projectWorld(id: string, wp: THREE.Vector3): { x: number; y: number } | null {
    const s = this.slots.get(id);
    if (!s || !s.rect.w) return null;
    const p = wp.clone().project(s.cam);
    return { x: s.rect.x + (p.x * 0.5 + 0.5) * s.rect.w, y: s.rect.y + (-p.y * 0.5 + 0.5) * s.rect.h };
  }

  /** Play a 3D object over the page in screen space (CSS px; y down): f places it each frame. */
  play(obj: THREE.Object3D, dur: number, f: (k: number, o: THREE.Object3D) => void, done?: () => void, persp = false) {
    this.scene.add(obj);
    this.moments.push({ obj, t: 0, dur, f, done, persp });
  }
  /** A persistent screen-space object (perspective pass): f updates it every frame until the returned stop(). */
  actor(obj: THREE.Object3D, f: (dt: number, t: number) => void): () => void {
    const a: Actor = { obj, f };
    this.scene.add(obj);
    this.actors.add(a);
    return () => { this.actors.delete(a); this.scene.remove(obj); };
  }

  update(dt: number) {
    this.t += dt;
    const R = this.R;
    R.setScissorTest(false);
    R.setViewport(0, 0, this.w, this.h);
    R.clear();
    R.setScissorTest(true);
    const hideAll = () => { for (const o of this.slots.values()) { o.obj.visible = false; if (o.shadow) o.shadow.visible = false; } for (const m of this.moments) m.obj.visible = false; for (const a of this.actors) a.obj.visible = false; };
    for (const s of this.slots.values()) {
      const b = s.el.getBoundingClientRect();
      s.rect = { x: b.left, y: b.top, w: b.width, h: b.height };
      if (b.width < 4 || b.bottom < 0 || b.top > innerHeight || !s.el.isConnected) continue;
      // refit for the first seconds (and for as long as nothing has loaded): owls arrive late on slow devices
      if (!s.o.focus && (s.r < 1e-4 || this.t - s.born < 8) && s.fits++ % 4 === 0) this.fit(s);
      if (s.r < 1e-4) continue;
      // springy hop when picked; slide forward when chosen, step back when another is
      s.selV += (-s.sel * 120 - s.selV * 10) * dt; s.sel += s.selV * dt;
      s.fwd += (s.want - s.fwd) * Math.min(1, dt * 7);
      const age = Math.min(1, (this.t - s.born) / 0.4), pop = age < 1 ? 1 - (1 - age) ** 3 : 1;
      const sway = (s.o.yaw ?? 0.6) + Math.sin(this.t * (s.o.spin ?? 0.5) + s.home.x * 0.07) * (s.o.sway ?? 0.5);
      s.obj.rotation.y = sway + Math.max(0, s.fwd) * Math.sin(this.t * 1.6) * 0.12;
      s.obj.position.y = s.home.y + Math.max(0, s.sel) * s.r * 0.25;
      s.obj.position.z = s.home.z + s.fwd * s.r * (s.fwd > 0 ? 0.42 : 0.3);
      s.obj.scale.setScalar(Math.max(0.001, pop));
      s.o.tick?.(s.obj, this.t, dt);
      const q = this.q, x = Math.floor(b.left / q), y = Math.floor((innerHeight - b.bottom) / q), w = Math.ceil(b.width / q), h = Math.ceil(b.height / q);
      const cam = s.cam;
      cam.aspect = w / h;
      const fit = Math.max(1, 1 / Math.min(1, cam.aspect));
      const tv = Math.tan((cam.fov * Math.PI) / 360);
      // a sphere fit for compact things; wide heaps fit their box to the window
      const pitch = s.o.pitch ?? 0.32;
      let dist: number;
      if (s.o.fit === 'h') {
        // what the camera sees of the box at this pitch: its height foreshortened plus the top of its depth
        const depth = Math.max(s.bd, s.bw * 0.7), ph = s.bh * Math.cos(pitch) + depth * Math.sin(pitch);
        dist = (s.o.zoom ?? 1) * Math.max(ph / 2 / (tv * 0.9), s.bw / 2 / (tv * cam.aspect * 0.92)) + depth * 0.3;
      } else dist = s.o.box ? (s.o.zoom ?? 1) * Math.max(s.bh / 2 / tv, s.bw / 2 / (tv * cam.aspect)) + s.bw / 2 : (s.r * (s.o.zoom ?? 1.0) * fit) / tv;
      const c = s.c.clone().add(V(0, s.r * (s.o.lift ?? 0), 0));
      cam.position.set(c.x, c.y + Math.sin(pitch) * dist, c.z + Math.cos(pitch) * dist);
      cam.near = Math.max(1e-3, dist - s.r * 3); cam.far = dist + s.r * 3;
      cam.lookAt(c);
      cam.updateProjectionMatrix();
      if (s.hidden) continue;
      R.setViewport(x, y, w, h);
      R.setScissor(x, y, w, h);
      R.clearDepth();
      // only this slot's object is near its camera; hide the rest for the pass
      hideAll();
      s.obj.visible = true;
      if (s.shadow && !s.o.focus) {
        s.shadow.visible = true;
        const lift = Math.max(0, s.sel) * 0.25;
        s.shadow.position.set(s.obj.position.x, s.home.y + 0.002 * s.r, s.obj.position.z);
        s.shadow.scale.set(s.bw * 1.25 * pop * (1 - lift * 0.5), (s.bd + s.bw) * 0.62 * pop * (1 - lift * 0.5), 1);
        (s.shadow.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - lift);
      }
      R.toneMappingExposure = this.exposure * (s.fwd < 0 ? 1 + s.fwd * 0.32 : 1 + s.fwd * 0.08);
      R.render(this.scene, cam);
    }
    R.toneMappingExposure = this.exposure;
    // the moments and actors, in screen space over everything
    if (this.moments.length || this.actors.size) {
      hideAll();
      R.setViewport(0, 0, this.w, this.h);
      R.setScissor(0, 0, this.w, this.h);
      R.clearDepth();
      const done: Moment[] = [];
      for (const m of this.moments) {
        m.t += dt * this.pace;
        const k = this.freeze ?? Math.min(1, m.t / m.dur);
        m.f(k, m.obj);
        if (k >= 1 && this.freeze === null) done.push(m);
      }
      for (const a of this.actors) a.f(dt, this.t);
      for (const m of this.moments) m.obj.visible = !m.persp;
      if (this.moments.some((m) => !m.persp)) R.render(this.scene, this.screen);
      for (const m of this.moments) m.obj.visible = m.persp;
      for (const a of this.actors) a.obj.visible = true;
      if (this.actors.size || this.moments.some((m) => m.persp)) { R.clearDepth(); R.render(this.scene, this.persp); }
      for (const m of done) { this.scene.remove(m.obj); this.moments.splice(this.moments.indexOf(m), 1); m.done?.(); }
    }
    for (const o of this.slots.values()) o.obj.visible = true;
  }

  dispose() {
    this.clearSlots();
    for (const a of this.actors) this.scene.remove(a.obj);
    this.actors.clear();
    this.R.dispose();
    this.canvas.remove();
  }
}
