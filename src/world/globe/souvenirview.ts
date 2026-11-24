// A souvenir on a little turntable, in its own small canvas (the place view's display case): the real GLB from
// public/models/souvenirs, lit like a museum case (warm key, cool rim, a room environment for the glints),
// turning slowly; drag to spin it.
// [globe] OWNED BY THE GLOBE BUILDER.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { instanceGLB } from '../../gfx/glb.ts';

export class SouvenirView {
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  private pivot = new THREE.Group();
  private obj: THREE.Object3D | null = null;
  private id = '';
  private raf = 0;
  private last = 0;
  private spin = 0;
  private vel = 0.45;
  private drag: { x: number; id: number } | null = null;
  private env: THREE.Texture;
  private dark = false;
  private size = { w: 1, h: 1 };
  private shadow: THREE.Mesh;

  constructor(private canvas: HTMLCanvasElement) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.05;
    this.r.setClearColor(0x000000, 0);
    const pm = new THREE.PMREMGenerator(this.r);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.env;
    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2c22, 0.9));
    const key = new THREE.DirectionalLight(0xffe6c4, 2.6);
    key.position.set(-2.5, 4, 3.5);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.6);
    rim.position.set(3, 2.5, -3.5);
    this.scene.add(key, rim, this.pivot);
    // a soft contact shadow on the plinth
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(20,10,4,0.55)'); gr.addColorStop(1, 'rgba(20,10,4,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    canvas.addEventListener('pointerdown', this.down);
    addEventListener('pointermove', this.move);
    addEventListener('pointerup', this.up);
    this.resize();
    this.loop(performance.now());
  }

  private down = (e: PointerEvent) => { this.drag = { x: e.clientX, id: e.pointerId }; this.vel = 0; };
  private move = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x;
    this.drag.x = e.clientX;
    this.spin += dx * 0.012;
    this.vel = dx * 0.6;
  };
  private up = (e: PointerEvent) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };

  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    if (this.obj) this.frame();
  }

  /** Show a souvenir (found or not: the card says which). */
  async show(id: string, found: boolean) {
    if (id === this.id && found === !this.dark) return;
    this.id = id;
    this.dark = !found;
    try {
      const { root } = await instanceGLB(`souvenirs/${id}.glb`);
      if (this.id !== id) return;
      if (this.obj) this.pivot.remove(this.obj);
      root.traverse((o) => { o.castShadow = o.receiveShadow = false; });
      this.obj = root;
      this.pivot.add(root);
      this.frame();
    } catch (e) { console.warn('souvenir', id, e); }
  }

  private frame() {
    const o = this.obj!;
    o.position.set(0, 0, 0);
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    o.position.set(-c.x, -box.min.y, -c.z);
    const r = Math.max(s.length() / 2, 1e-3);
    const fit = Math.min(1, this.cam.aspect);
    const d = r / Math.sin((this.cam.fov / 2) * Math.PI / 180) / fit * 0.95;
    const pitch = 0.32;
    this.cam.position.set(0, s.y * 0.5 + Math.sin(pitch) * d, Math.cos(pitch) * d);
    this.cam.lookAt(0, s.y * 0.45, 0);
    this.cam.near = d / 30; this.cam.far = d * 5;
    this.cam.updateProjectionMatrix();
    this.shadow.scale.set(Math.max(s.x, s.z) * 1.5, Math.max(s.x, s.z) * 1.5, 1);
    this.shadow.position.set(0, 0.002, 0);
  }

  private loop = (ms: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.last ? (ms - this.last) / 1000 : 0.016);
    this.last = ms;
    if (!this.drag) { this.vel += (0.45 - this.vel) * (1 - Math.exp(-dt * 1.5)); this.spin += this.vel * dt; }
    this.pivot.rotation.y = this.spin;
    if (this.canvas.isConnected) { this.resize(); this.r.render(this.scene, this.cam); }
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.down);
    removeEventListener('pointermove', this.move);
    removeEventListener('pointerup', this.up);
    this.env.dispose();
    this.r.dispose();
    this.r.forceContextLoss();
  }
}
