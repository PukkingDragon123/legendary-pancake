// The 3D elements of the interview's 2D form layer: a transparent WebGL layer above the form that draws live 3D
// models inside the answer cards (slowly turning, hopping when picked), and the 3D moments that play over the
// paper: the fountain pen swooping in to tick a box, the rubber stamp slamming onto the office box. It renders at
// half the form's pixel scale, so the models are crisp pixel art a step finer than the painted paper.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SlotOpts { spin?: number; pitch?: number; zoom?: number; yaw?: number; lift?: number; box?: boolean; focus?: { c: THREE.Vector3; r: number }; tick?: (o: THREE.Object3D, t: number, dt: number) => void }
interface Slot { el: HTMLElement; obj: THREE.Object3D; cam: THREE.PerspectiveCamera; r: number; c: THREE.Vector3; bw: number; bh: number; o: SlotOpts; sel: number; selV: number; born: number; home: THREE.Vector3; fits: number }
interface Moment { obj: THREE.Object3D; t: number; dur: number; f: (k: number, o: THREE.Object3D) => void; done?: () => void }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class Overlay3D {
  readonly canvas = document.createElement('canvas');
  private R: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private slots = new Map<string, Slot>();
  private moments: Moment[] = [];
  private screen = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  private t = 0;
  private n = 0;
  /** CSS px per pixel of this layer (the form's pixel scale) */
  k = 2;
  private w = 1; private h = 1;
  /** time scale of the moments (1; the dev harness slows them down to look at them) */
  pace = 1;
  /** hold every moment at this point of its play (dev harness), or null */
  freeze: number | null = null;
  /** CSS px per pixel actually drawn: half the form's pixel, so small models stay legible (never below 1) */
  private get q() { return Math.max(1, Math.round(this.k / 2)); }

  constructor() {
    const c = this.canvas;
    Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '46', imageRendering: 'pixelated' });
    this.R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: false, premultipliedAlpha: true });
    this.R.setPixelRatio(1);
    this.R.outputColorSpace = THREE.SRGBColorSpace;
    this.R.toneMapping = THREE.ACESFilmicToneMapping;
    this.R.toneMappingExposure = 1.05;
    this.R.setClearColor(0x000000, 0);
    this.R.autoClear = false;
    try { this.scene.environment = new THREE.PMREMGenerator(this.R).fromScene(new RoomEnvironment(), 0.04).texture; (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.5; } catch { /* plain lights */ }
    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2414, 1.1));
    const key = new THREE.DirectionalLight(0xffe0b0, 2.4); key.position.set(-2, 4, 3); this.scene.add(key);
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
  }
  setScale(k: number) { if (k !== this.k) { this.k = k; this.resize(); } }

  /** Put a model in a card's window (the element's box). The model is fitted and framed in a three-quarter view. */
  setSlot(id: string, el: HTMLElement, obj: THREE.Object3D, o: SlotOpts = {}) {
    this.removeSlot(id);
    const home = V(this.n++ * 50, 0, 0);
    obj.position.add(home);
    this.scene.add(obj);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 200);
    const s: Slot = { el, obj, cam, r: 0, c: home.clone(), bw: 0, bh: 0, o, sel: 0, selV: 0, born: this.t, home, fits: 0 };
    this.fit(s);
    this.slots.set(id, s);
  }
  /** frame the model (again: models that load late, like the owls, are refitted for their first frames) */
  private fit(s: Slot) {
    if (s.o.focus) { s.c.copy(s.home).add(s.o.focus.c); s.r = s.o.focus.r; return; }
    const rot = s.obj.rotation.y, sc = s.obj.scale.x, py = s.obj.position.y;
    s.obj.rotation.y = 0; s.obj.scale.setScalar(1); s.obj.position.y = s.home.y;
    s.obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s.obj);
    s.obj.rotation.y = rot; s.obj.scale.setScalar(sc); s.obj.position.y = py;
    if (box.isEmpty()) return;
    const sph = box.getBoundingSphere(new THREE.Sphere()), sz = box.getSize(V(0, 0, 0));
    s.r = sph.radius; s.c.copy(sph.center); s.bw = Math.max(sz.x, sz.z); s.bh = sz.y;
  }
  removeSlot(id: string) { const s = this.slots.get(id); if (!s) return; this.scene.remove(s.obj); this.slots.delete(id); }
  clearSlots() { for (const id of [...this.slots.keys()]) this.removeSlot(id); }
  /** a little hop when picked */
  pick(id: string) { const s = this.slots.get(id); if (s) s.selV += 5; }

  /** Play a 3D object over the page in screen space (CSS px; y down): f places it each frame. */
  play(obj: THREE.Object3D, dur: number, f: (k: number, o: THREE.Object3D) => void, done?: () => void) {
    this.scene.add(obj);
    this.moments.push({ obj, t: 0, dur, f, done });
  }

  update(dt: number) {
    this.t += dt;
    const R = this.R;
    R.setScissorTest(false);
    R.setViewport(0, 0, this.w, this.h);
    R.clear();
    R.setScissorTest(true);
    for (const s of this.slots.values()) {
      const b = s.el.getBoundingClientRect();
      if (b.width < 4 || b.bottom < 0 || b.top > innerHeight || !s.el.isConnected) continue;
      // refit for the first seconds (and for as long as nothing has loaded): owls arrive late on slow devices
      if (!s.o.focus && (s.r < 1e-4 || this.t - s.born < 8) && s.fits++ % 4 === 0) this.fit(s);
      if (s.r < 1e-4) continue;
      // springy hop when picked
      s.selV += (-s.sel * 120 - s.selV * 10) * dt; s.sel += s.selV * dt;
      const age = Math.min(1, (this.t - s.born) / 0.4), pop = age < 1 ? 1 - (1 - age) ** 3 : 1;
      const spin = (s.o.yaw ?? 0.6) + Math.sin(this.t * (s.o.spin ?? 0.5)) * 0.5;
      s.obj.rotation.y = spin;
      s.obj.position.y = s.home.y + s.sel * s.r * 0.25;
      s.obj.scale.setScalar(Math.max(0.001, pop));
      s.o.tick?.(s.obj, this.t, dt);
      const q = this.q, x = Math.floor(b.left / q), y = Math.floor((innerHeight - b.bottom) / q), w = Math.ceil(b.width / q), h = Math.ceil(b.height / q);
      const cam = s.cam;
      cam.aspect = w / h;
      const fit = Math.max(1, 1 / Math.min(1, cam.aspect));
      const tv = Math.tan((cam.fov * Math.PI) / 360);
      // a sphere fit for compact things; wide heaps fit their box to the window
      const dist = s.o.box ? (s.o.zoom ?? 1) * Math.max(s.bh / 2 / tv, s.bw / 2 / (tv * cam.aspect)) + s.bw / 2 : (s.r * (s.o.zoom ?? 1.0) * fit) / tv;
      const pitch = s.o.pitch ?? 0.32;
      const c = s.c.clone().add(V(0, s.r * (s.o.lift ?? 0), 0));
      cam.position.set(c.x, c.y + Math.sin(pitch) * dist, c.z + Math.cos(pitch) * dist);
      cam.near = Math.max(1e-3, dist - s.r * 3); cam.far = dist + s.r * 3;
      cam.lookAt(c);
      cam.updateProjectionMatrix();
      R.setViewport(x, y, w, h);
      R.setScissor(x, y, w, h);
      // only this slot's object is near its camera; hide the rest for the pass
      for (const o of this.slots.values()) o.obj.visible = o === s;
      for (const m of this.moments) m.obj.visible = false;
      R.render(this.scene, cam);
    }
    // the moments, in screen space over everything
    if (this.moments.length) {
      for (const o of this.slots.values()) o.obj.visible = false;
      R.setViewport(0, 0, this.w, this.h);
      R.setScissor(0, 0, this.w, this.h);
      for (const m of [...this.moments]) {
        m.t += dt * this.pace;
        const k = this.freeze ?? Math.min(1, m.t / m.dur);
        m.obj.visible = true;
        m.f(k, m.obj);
        if (k >= 1) { this.scene.remove(m.obj); this.moments.splice(this.moments.indexOf(m), 1); m.done?.(); }
      }
      R.render(this.scene, this.screen);
    }
    for (const o of this.slots.values()) o.obj.visible = true;
  }

  dispose() {
    this.clearSlots();
    this.R.dispose();
    this.canvas.remove();
  }
}
