// Pixel particles for the globe: Pip's sparkle trail, sparkles rising from the picked place and from tonight's
// destination, a bright mote running along the flight path, and the odd shooting star across the sky. Every
// particle is one or two art pixels, and fades by thinning out on a Bayer pattern instead of going transparent.
// [globe] OWNED BY THE GLOBE BUILDER.
import * as THREE from 'three';

const VS = /* glsl */ `attribute float aSize; attribute float aLife; attribute vec3 aCol; varying float vLife; varying vec3 vCol;
void main(){ vLife = aLife; vCol = aCol; gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = /* glsl */ `varying float vLife; varying vec3 vCol;
float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0);
  float b = q.x == 0.0 ? (q.y == 0.0 ? 0.0 : q.y == 1.0 ? 12.0 : q.y == 2.0 ? 3.0 : 15.0)
          : q.x == 1.0 ? (q.y == 0.0 ? 8.0 : q.y == 1.0 ? 4.0 : q.y == 2.0 ? 11.0 : 7.0)
          : q.x == 2.0 ? (q.y == 0.0 ? 2.0 : q.y == 1.0 ? 14.0 : q.y == 2.0 ? 1.0 : 13.0)
          : (q.y == 0.0 ? 10.0 : q.y == 1.0 ? 6.0 : q.y == 2.0 ? 9.0 : 5.0);
  return (b + 0.5) / 16.0; }
void main(){
  if (vLife <= 0.0 || bayer(gl_FragCoord.xy) > vLife * 1.4) discard;
  gl_FragColor = vec4(vLife > 0.7 ? mix(vCol, vec3(1.0, 0.97, 0.88), 0.5) : vCol, 1.0);
}`;

const COLS: Record<string, [number, number, number][]> = {
  gold: [[0.95, 0.83, 0.6], [0.86, 0.69, 0.45], [0.98, 0.92, 0.76]],
  cool: [[0.83, 0.8, 0.88], [0.74, 0.84, 0.86], [0.96, 0.96, 0.92]],
  meteor: [[0.98, 0.95, 0.85], [0.9, 0.86, 0.95]],
};

export class Sparks {
  readonly points: THREE.Points;
  private n: number;
  private pos: Float32Array; private col: Float32Array; private size: Float32Array; private life: Float32Array;
  private vel: Float32Array; private age: Float32Array; private max: Float32Array;
  private next = 0;
  private meteor: { p: THREE.Vector3; v: THREE.Vector3; t: number } | null = null;
  private meteorIn = 4;
  onMeteor: (() => void) | null = null;

  constructor(n = 600) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.life = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.age = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, depthWrite: false }));
    this.points.frustumCulled = false;
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, life: number, kind: keyof typeof COLS, size = 1) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    const c = COLS[kind][Math.floor(Math.random() * COLS[kind].length)];
    this.col.set(c, i * 3);
    this.size[i] = size;
    this.age[i] = 0; this.max[i] = life; this.life[i] = 1;
  }

  /** a puff of sparkles rising off the globe's surface at a world point (normal = outward) */
  rise(at: THREE.Vector3, normal: THREE.Vector3, kind: keyof typeof COLS = 'gold') {
    const t = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.06);
    this.emit(at.clone().addScaledVector(normal, 0.02).add(t), normal.clone().multiplyScalar(0.08 + Math.random() * 0.08).add(t.multiplyScalar(0.6)), 0.9 + Math.random() * 0.7, kind, Math.random() < 0.2 ? 2 : 1);
  }

  update(dt: number, camPos: THREE.Vector3) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const k = i * 3;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.vel[k] *= 1 - dt * 0.8; this.vel[k + 1] *= 1 - dt * 0.8; this.vel[k + 2] *= 1 - dt * 0.8;
      this.life[i] = Math.max(0, 1 - this.age[i] / this.max[i]);
    }
    // shooting stars across the far sky, now and then
    this.meteorIn -= dt;
    if (!this.meteor && this.meteorIn <= 0) {
      const dir = camPos.clone().normalize().negate();
      const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), up = dir.clone().cross(side).normalize();
      const start = dir.clone().multiplyScalar(30).addScaledVector(side, (Math.random() - 0.5) * 30).addScaledVector(up, 6 + Math.random() * 10);
      const v = side.clone().multiplyScalar(Math.random() < 0.5 ? -18 : 18).addScaledVector(up, -7);
      this.meteor = { p: start, v, t: 0.9 };
      this.meteorIn = 5 + Math.random() * 7;
      this.onMeteor?.();
    }
    if (this.meteor) {
      const m = this.meteor;
      m.t -= dt;
      for (let s = 0; s < 3; s++) {
        m.p.addScaledVector(m.v, dt / 3);
        this.emit(m.p, m.v.clone().multiplyScalar(0.02), 0.45, 'meteor', s === 0 ? 2 : 1);
      }
      if (m.t <= 0) this.meteor = null;
    }
    const g = this.points.geometry;
    for (const name of ['position', 'aCol', 'aSize', 'aLife']) (g.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
  }
}
