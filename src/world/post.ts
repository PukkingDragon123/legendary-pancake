// [world3] BUSHED's look for Hoot Hollow (ported from the owner's lumberjack game, src/gfx/renderer.ts, and cut
// down for phones): the world is drawn into a low internal-resolution HDR target, then
//   1. a soft-knee bloom at quarter resolution (lantern windows, the moon, fireflies glow a little),
//   2. a composite at internal resolution: exposure, contrast around mid grey, a gentle filmic shoulder, the
//      grade (lift / gamma / gain, split toning: warm lights and cool shadows by day, blue nights), saturation,
//      vignette, per-pixel animated grain and an ordered dither + quantise,
//   3. a nearest-neighbour upscale to the canvas.
// Every pass snaps to the internal pixel grid, so the picture reads as crisp, high-resolution pixel art while the
// DOM UI above it stays sharp. Stages (the interview room, the shop...) go through the same chain.
import * as THREE from 'three';

export interface Grade {
  exposure: number; contrast: number; saturation: number; warm: number;
  lift: THREE.Vector3; gamma: THREE.Vector3; gain: THREE.Vector3;
  vignette: number; grain: number; bloom: number; quant: number; cold: number;
}

export function defaultGrade(): Grade {
  return {
    exposure: 0.92, contrast: 1.04, saturation: 0.94, warm: 0.2,
    lift: new THREE.Vector3(0.0, 0.004, 0.012), gamma: new THREE.Vector3(1, 1, 1), gain: new THREE.Vector3(1, 1, 1),
    vignette: 0.3, grain: 0.035, bloom: 0.35, quant: 48, cold: 0,
  };
}

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BAYER = /* glsl */ `
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x) + int(q.y) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[i] / 16.0;
}`;

function quad(mat: THREE.Material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
}

export class Post {
  /** CSS pixels per internal pixel */
  pixel: number;
  grade = defaultGrade();
  enabled = true;
  private rt!: THREE.WebGLRenderTarget;
  private ldr!: THREE.WebGLRenderTarget;
  private qA!: THREE.WebGLRenderTarget;
  private qB!: THREE.WebGLRenderTarget;
  private eA!: THREE.WebGLRenderTarget;
  private eB!: THREE.WebGLRenderTarget;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private quadMesh: THREE.Mesh;
  private mBright: THREE.ShaderMaterial;
  private mBlur: THREE.ShaderMaterial;
  private mComp: THREE.ShaderMaterial;
  private mBlit: THREE.ShaderMaterial;
  private w = 1; private h = 1; private frame = 0;
  private bloomOn: boolean;

  constructor(private gl: THREE.WebGLRenderer, quality: 'low' | 'high') {
    this.bloomOn = quality === 'high';
    // phones get a slightly finer grid so small things stay readable; big screens the full BUSHED chunk
    this.pixel = Math.min(innerWidth, innerHeight) < 600 ? 1.5 : 2;
    this.mBright = new THREE.ShaderMaterial({
      vertexShader: VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uThresh: { value: 0.9 }, uTexel: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform float uThresh; uniform vec2 uTexel; varying vec2 vUv;
        vec3 tap(vec2 o) { return min(texture2D(tSrc, vUv + o * uTexel).rgb, vec3(40.0)); }
        void main() {
          vec3 c = (tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))) * 0.25;
          float l = max(c.r, max(c.g, c.b));
          float k = uThresh * 0.5;
          float s = clamp(l - uThresh + k, 0.0, 2.0 * k);
          s = s * s / (4.0 * k + 1e-4);
          gl_FragColor = vec4(c * (max(s, l - uThresh) / max(l, 1e-4)), 1.0);
        }`,
    });
    this.mBlur = new THREE.ShaderMaterial({
      vertexShader: VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
        void main() {
          vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
          s += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
          s += (texture2D(tSrc, vUv + uDir * 3.23).rgb + texture2D(tSrc, vUv - uDir * 3.23).rgb) * 0.070;
          gl_FragColor = vec4(s, 1.0);
        }`,
    });
    this.mComp = new THREE.ShaderMaterial({
      vertexShader: VERT, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, uBloomOn: { value: 0 },
        uRes: { value: new THREE.Vector2() }, uFrame: { value: 0 }, uTime: { value: 0 },
        uExposure: { value: 1 }, uCon: { value: 1 }, uSat: { value: 1 }, uWarm: { value: 0 }, uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) },
        uGain: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: 0 }, uGrain: { value: 0 }, uBloom: { value: 0 }, uQuant: { value: 48 }, uCold: { value: 0 },
      },
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform float uBloomOn;
        uniform vec2 uRes; uniform float uFrame; uniform float uTime;
        uniform float uExposure; uniform float uCon; uniform float uSat; uniform float uWarm; uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain;
        uniform float uVig; uniform float uGrain; uniform float uBloom; uniform float uQuant; uniform float uCold;
        varying vec2 vUv;
        ${BAYER}
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }
        vec3 filmic(vec3 x) { x *= 0.9; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main() {
          vec2 px = floor(vUv * uRes);
          vec2 uv = (px + 0.5) / uRes;
          vec3 col = texture2D(tColor, uv).rgb;
          if (uBloomOn > 0.5) col += (texture2D(tBloom, uv).rgb * 0.6 + texture2D(tBloom2, uv).rgb * 0.8) * uBloom;
          col *= uExposure;
          col = 0.18 * pow(max(col, vec3(1e-5)) / 0.18, vec3(uCon));
          col = filmic(col);
          col = pow(max(col, 0.0), 1.0 / uGamma);
          col = col * uGain + uLift * (1.0 - col);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          // split toning: warm highlights / cool shadows by day, blue shadows at night (lamplight stays warm)
          col += max(uWarm, 0.0) * vec3(0.05, 0.02, -0.035) * smoothstep(0.25, 0.85, l);
          col += (0.35 + max(-uWarm, 0.0)) * vec3(-0.010, 0.003, 0.016) * (1.0 - smoothstep(0.0, 0.32, l));
          col = max(col, 0.0);
          l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          vec2 cc = vUv - 0.5;
          float r2 = dot(cc, cc);
          col = mix(col, mix(vec3(l), col, 0.6) * vec3(0.9, 0.96, 1.06), uCold * smoothstep(0.05, 0.4, r2));
          col *= 1.0 - uVig * smoothstep(0.12, 0.7, r2 * 1.3);
          col = toSRGB(clamp(col, 0.0, 1.0));
          float g = hash(px + floor(uTime * 24.0) * 17.0) - 0.5;
          col += g * uGrain * (1.2 - l);
          col = floor(col * uQuant + 0.5 + (bayer4(px) - 0.5) * 0.9) / uQuant;
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
    });
    this.mBlit = new THREE.ShaderMaterial({
      vertexShader: VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null } },
      fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }',
    });
    this.quadMesh = quad(this.mComp);
    this.scene.add(this.quadMesh);
    this.resize(innerWidth, innerHeight);
  }

  /** Internal resolution (for anything that needs to snap to the pixel grid). */
  get size(): [number, number] { return [this.w, this.h]; }

  resize(W: number, H: number) {
    this.w = Math.max(64, Math.round(W / this.pixel));
    this.h = Math.max(64, Math.round(H / this.pixel));
    for (const t of [this.rt, this.ldr, this.qA, this.qB, this.eA, this.eB]) t?.dispose();
    const depth = new THREE.DepthTexture(this.w, this.h);
    depth.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: depth, samples: 0 });
    this.ldr = new THREE.WebGLRenderTarget(this.w, this.h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    const mk = (w: number, h: number) => new THREE.WebGLRenderTarget(Math.max(8, w), Math.max(8, h), { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.qA = mk(this.w >> 2, this.h >> 2); this.qB = mk(this.w >> 2, this.h >> 2);
    this.eA = mk(this.w >> 3, this.h >> 3); this.eB = mk(this.w >> 3, this.h >> 3);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quadMesh.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.scene, this.cam);
  }

  /** Draw a scene through the chain onto the canvas. */
  render(scene: THREE.Scene, camera: THREE.Camera, time: number) {
    const gl = this.gl;
    if (!this.enabled) { gl.setRenderTarget(null); gl.render(scene, camera); return; }
    this.frame++;
    gl.setRenderTarget(this.rt);
    gl.clear();
    gl.render(scene, camera);
    const g = this.grade, u = this.mComp.uniforms;
    if (this.bloomOn && g.bloom > 0.01) {
      this.mBright.uniforms.tSrc.value = this.rt.texture;
      this.mBright.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mBright, this.qA);
      const blur = (a: THREE.WebGLRenderTarget, b: THREE.WebGLRenderTarget) => {
        this.mBlur.uniforms.tSrc.value = a.texture; this.mBlur.uniforms.uDir.value.set(1 / a.width, 0); this.pass(this.mBlur, b);
        this.mBlur.uniforms.tSrc.value = b.texture; this.mBlur.uniforms.uDir.value.set(0, 1 / a.height); this.pass(this.mBlur, a);
      };
      blur(this.qA, this.qB);
      this.mBlit.uniforms.tSrc.value = this.qA.texture;
      this.pass(this.mBlit, this.eA);
      blur(this.eA, this.eB);
      u.tBloom.value = this.qA.texture; u.tBloom2.value = this.eA.texture; u.uBloomOn.value = 1;
    } else u.uBloomOn.value = 0;
    u.tColor.value = this.rt.texture;
    u.uRes.value.set(this.w, this.h); u.uFrame.value = this.frame % 1000; u.uTime.value = time;
    u.uExposure.value = g.exposure; u.uCon.value = g.contrast; u.uSat.value = g.saturation; u.uWarm.value = g.warm;
    u.uLift.value.copy(g.lift); u.uGamma.value.copy(g.gamma); u.uGain.value.copy(g.gain);
    u.uVig.value = g.vignette; u.uGrain.value = g.grain; u.uBloom.value = g.bloom; u.uQuant.value = g.quant; u.uCold.value = g.cold;
    this.pass(this.mComp, this.ldr);
    this.mBlit.uniforms.tSrc.value = this.ldr.texture;
    this.pass(this.mBlit, null);
  }

  dispose() { for (const t of [this.rt, this.ldr, this.qA, this.qB, this.eA, this.eB]) t.dispose(); }
}
