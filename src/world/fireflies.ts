// Fireflies: each one is a crisp 2x2 pixel core inside a soft glow halo, blinking on its own slow
// rhythm and drifting on a lazy wander. They can be gathered towards a point (the breathing
// exercise pulls them in on the inhale and releases them on the exhale).
import * as THREE from 'three';

const VS = /* glsl */ `
attribute vec4 iPos;   // xyz, phase
attribute vec2 iData;  // size, hue
uniform float uTime; uniform float uAlpha; uniform float uPix;
varying vec2 vUv; varying float vBlink; varying float vHue;
void main() {
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  float blink = 0.5 + 0.5 * sin(uTime * (1.3 + fract(iPos.w * 7.3) * 1.4) + iPos.w * 6.2831);
  blink = smoothstep(0.15, 1.0, blink);
  vBlink = blink * uAlpha;
  vHue = iData.y;
  mv.xy += position.xy * iData.x * (0.75 + 0.5 * blink);
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}`;
const FS = /* glsl */ `
uniform float uPix;
varying vec2 vUv; varying float vBlink; varying float vHue;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p);
  // pixel core: a hard 2x2-ish square in the middle of the sprite
  vec2 q = floor(vUv * uPix) - floor(uPix * 0.5);
  float core = step(abs(q.x + 0.5), 1.0) * step(abs(q.y + 0.5), 1.0);
  float halo = pow(max(0.0, 1.0 - d * 2.0), 2.6);
  // quantise the halo into a few rings so it reads as pixel art, not airbrush
  halo = floor(halo * 5.0) / 5.0;
  vec3 warm = mix(vec3(1.0, 0.86, 0.35), vec3(0.72, 1.0, 0.55), vHue);
  vec3 col = warm * (halo * 0.55 + core * 1.4);
  float a = (halo * 0.7 + core) * vBlink;
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
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uPix: { value: 12 } },
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
