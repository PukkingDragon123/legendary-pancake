// Fireflies: each one a hot yellow-green point of light in a soft halo that blooms as it glows (high dynamic range,
// so the post chain's bloom carries it), blinking on its own slow rhythm and drifting on a lazy wander, its glow
// fading in and out rather than switching. They can be gathered towards a point (the breathing exercise pulls them
// in on the inhale and releases them on the exhale). [fx10]
import * as THREE from 'three';

const VS = /* glsl */ `
attribute vec4 iPos;   // xyz, phase
attribute vec2 iData;  // size, hue
uniform float uTime; uniform float uAlpha;
varying vec2 vUv; varying float vBlink; varying float vHue;
void main() {
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  float blink = 0.5 + 0.5 * sin(uTime * (1.3 + fract(iPos.w * 7.3) * 1.4) + iPos.w * 6.2831);
  blink = smoothstep(0.15, 1.0, blink);
  vBlink = blink * uAlpha;
  vHue = iData.y;
  mv.xy += position.xy * iData.x * (0.85 + 0.45 * blink);
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}`;
const FS = /* glsl */ `
varying vec2 vUv; varying float vBlink; varying float vHue;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  // a hot point, a tight glow round it and a wide soft halo that swells with the light
  float core = exp(-r2 * 140.0), inner = exp(-r2 * 34.0), halo = exp(-r2 * 7.0) * (1.0 - smoothstep(0.6, 1.0, sqrt(r2)));
  vec3 warm = mix(vec3(1.0, 0.84, 0.42), vec3(0.76, 0.95, 0.46), vHue);
  vec3 col = mix(warm, vec3(1.0, 0.98, 0.88), core) * (core * 3.0 + inner * 0.7 + halo * 0.2 * vBlink);
  float a = vBlink;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * a, 1.0);
}`;

interface Fly { p: THREE.Vector3; v: THREE.Vector3; home: THREE.Vector3; phase: number; wander: number }

export class Fireflies {
  readonly mesh: THREE.Mesh;
  private flies: Fly[] = [];
  private pos: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  readonly mat: THREE.ShaderMaterial;
  /** 0..1 overall visibility (night) */
  alpha = 0;
  /** gather point and strength 0..1 (breathing) */
  gather: THREE.Vector3 | null = null;
  pull = 0;
  /** extra outward push 0..1 (exhale release) */
  release = 0;

  constructor(count: number, centre: THREE.Vector3, radius: number, height = [0.4, 3.2]) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      const home = new THREE.Vector3(centre.x + Math.cos(a) * r, height[0] + Math.random() * (height[1] - height[0]), centre.z + Math.sin(a) * r);
      this.flies.push({ p: home.clone(), v: new THREE.Vector3(), home, phase: Math.random(), wander: Math.random() * 100 });
    }
    const g = (this.geo = new THREE.InstancedBufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(count * 4);
    const dat = new Float32Array(count * 2);
    this.flies.forEach((f, i) => { dat[i * 2] = 0.34 + Math.random() * 0.22; dat[i * 2 + 1] = Math.random() < 0.3 ? 1 : Math.random() * 0.3; this.pos[i * 4 + 3] = f.phase; });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 4));
    g.setAttribute('iData', new THREE.InstancedBufferAttribute(dat, 2));
    g.instanceCount = count;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
  }

  /** Move the swarm's home area (e.g. around the owl for breathing). */
  rehome(centre: THREE.Vector3, radius: number, height: [number, number]) {
    for (const f of this.flies) {
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.sqrt(Math.random()) * radius;
      f.home.set(centre.x + Math.cos(a) * r, height[0] + Math.random() * (height[1] - height[0]), centre.z + Math.sin(a) * r * 0.7);
    }
  }

  /** The firefly nearest a tap ray (within reach), or -1. */
  pick(ray: THREE.Ray, reach = 0.55): number {
    if (this.alpha < 0.5) return -1;
    let best = -1, bd = reach;
    this.flies.forEach((f, i) => { const d = ray.distanceToPoint(f.p); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  position(i: number) { return this.flies[i].p.clone(); }
  /** Send a caught firefly back out into the dark somewhere else. */
  respawn(i: number) {
    const f = this.flies[i], a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 6;
    f.p.set(Math.cos(a) * r, 0.5 + Math.random() * 2.4, Math.sin(a) * r);
    f.v.set(0, 0, 0);
  }

  update(dt: number, t: number) {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uAlpha.value = this.alpha;
    this.mesh.visible = this.alpha > 0.01;
    if (!this.mesh.visible) return;
    const tmp = new THREE.Vector3();
    this.flies.forEach((f, i) => {
      // lazy wander around home
      f.wander += dt * 0.45;
      const w = f.wander;
      tmp.set(Math.sin(w * 1.3 + f.phase * 9) * 0.5, Math.sin(w * 0.9 + f.phase * 4) * 0.25, Math.cos(w * 1.1 + f.phase * 7) * 0.5).add(f.home).sub(f.p);
      f.v.addScaledVector(tmp, dt * 0.9);
      if (this.gather && this.pull > 0) {
        tmp.copy(this.gather).sub(f.p);
        const d = tmp.length();
        if (d > 0.35) f.v.addScaledVector(tmp.normalize(), dt * this.pull * 3.2);
        // a gentle orbit so they swirl in rather than crash into the centre
        f.v.x += -tmp.z * dt * this.pull * 0.8; f.v.z += tmp.x * dt * this.pull * 0.8;
      }
      if (this.gather && this.release > 0) {
        tmp.copy(f.p).sub(this.gather).setY(0.15).normalize();
        f.v.addScaledVector(tmp, dt * this.release * 2.4);
      }
      f.v.multiplyScalar(Math.exp(-dt * 1.6));
      f.p.addScaledVector(f.v, dt);
      this.pos[i * 4] = f.p.x; this.pos[i * 4 + 1] = f.p.y; this.pos[i * 4 + 2] = f.p.z;
    });
    (this.geo.attributes.iPos as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
}
