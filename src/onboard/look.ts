// The office's own picture (the world's post chain steps aside while the interview is up, like the globe):
//   1. the office is drawn into an HDR target at the canvas's full resolution ([light7]; multisampled on high), with its depth,
//   2. bloom: a soft-knee bright pass at quarter and eighth resolution (the banker's lamp, the window, brass glints),
//   3. depth of field: a half-resolution background blur weighted by each texel's circle of confusion, so the
//      subject stays crisp, the far wall goes soft and nothing in focus bleeds into the blur,
//   4. a composite: exposure, a filmic shoulder, a warm golden grade that adds saturation, a gentle vignette,
//      light grain and an 8-bit ordered dither (no posterising),
//   5. an overlay drawn crisp on top (Pip's words), then shown 1:1 on the canvas.
// [outline9] plus the game's ink outlines (src/gfx/ink.ts) in the composite; knobs in `outline`.
// The Stage hands the renderer `present` (a scene with one full-screen triangle) to draw.
import * as THREE from 'three';
import { Ink, inkDev, INK_GLSL, defaultInk, inkUniforms, type InkLook } from '../gfx/ink.ts'; // [outline9]

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BAYER = /* glsl */ `
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x) + int(q.y) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[i] / 16.0;
}`;
const DEPTH = /* glsl */ `
uniform sampler2D tDepth; uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uRange; uniform float uNearBlur;
float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).x; return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
float coc(vec2 uv) {
  float z = -viewZ(uv);
  float far = smoothstep(uFocus + uRange * 0.25, uFocus + uRange * 1.6, z);
  float nearB = smoothstep(uFocus * 0.6, uFocus * 0.25, z) * uNearBlur;
  return clamp(max(far, nearB), 0.0, 1.0);
}`;

function tri() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export interface LookGrade { exposure: number; warm: number; sat: number; contrast: number; vignette: number; grain: number; bloom: number; dof: number; focus: number; range: number; nearBlur: number }

export class Look {
  grade: LookGrade = { exposure: 1.0, warm: 0.35, sat: 1.12, contrast: 1.06, vignette: 0.32, grain: 0.03, bloom: 0.38, dof: 1, focus: 3, range: 2, nearBlur: 0 };
  /** CSS px per internal texel */
  px = 1;
  w = 2; h = 2;
  readonly present = new THREE.Scene();
  readonly overlay = new THREE.Scene();
  private rt: THREE.WebGLRenderTarget;
  private ldr: THREE.WebGLRenderTarget;
  private hA: THREE.WebGLRenderTarget; private hB: THREE.WebGLRenderTarget;
  private qA: THREE.WebGLRenderTarget; private qB: THREE.WebGLRenderTarget;
  private eA: THREE.WebGLRenderTarget; private eB: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private passScene = new THREE.Scene();
  private mBright: THREE.ShaderMaterial; private mBlur: THREE.ShaderMaterial; private mDown: THREE.ShaderMaterial; private mBlurW: THREE.ShaderMaterial;
  private mComp: THREE.ShaderMaterial; private mBlit: THREE.ShaderMaterial;
  private frame = 0;
  private bloomOn: boolean;
  /** [outline9] ink outlines: strength, width, crease, far (metres) */
  readonly outline: InkLook = { ...defaultInk(), far: 20 }; // [look12] (was 14: the bookcases at the back kept their lines)
  private ink: Ink;

  constructor(private gl: THREE.WebGLRenderer, quality: 'low' | 'high') {
    this.bloomOn = quality === 'high';
    this.ink = new Ink(gl, quality === 'high' ? 'high' : 'medium'); // [outline9]
    this.present.userData.noInk = true; // [outline9] the world's chain must not ink this finished picture again
    const mk = () => new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    const depth = new THREE.DepthTexture(8, 8); depth.type = THREE.UnsignedIntType;
    // [light7] full resolution, multisampled on the high tier (no pixelated look)
    this.rt = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthTexture: depth, samples: quality === 'high' ? 4 : 0 });
    this.ldr = new THREE.WebGLRenderTarget(8, 8, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.hA = mk(); this.hB = mk(); this.qA = mk(); this.qB = mk(); this.eA = mk(); this.eB = mk();
    const base = { vertexShader: VERT, depthTest: false, depthWrite: false };
    this.mBright = new THREE.ShaderMaterial({
      ...base, uniforms: { tSrc: { value: null }, uThresh: { value: 1.35 }, uTexel: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */ `uniform sampler2D tSrc; uniform float uThresh; uniform vec2 uTexel; varying vec2 vUv;
        vec3 tap(vec2 o) { return min(texture2D(tSrc, vUv + o * uTexel).rgb, vec3(30.0)); }
        void main() {
          vec3 c = (tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))) * 0.25;
          float l = max(c.r, max(c.g, c.b)), k = uThresh * 0.5;
          float s = clamp(l - uThresh + k, 0.0, 2.0 * k); s = s * s / (4.0 * k + 1e-4);
          gl_FragColor = vec4(c * max(s, l - uThresh) / max(l, 1e-4), 1.0);
        }`,
    });
    this.mBlur = new THREE.ShaderMaterial({
      ...base, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */ `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
          c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
          c += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    // background blur source: colour pre-multiplied by its circle of confusion
    this.mDown = new THREE.ShaderMaterial({
      ...base, uniforms: { tSrc: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 50 }, uFocus: { value: 3 }, uRange: { value: 2 }, uNearBlur: { value: 0 }, uTexel: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */ `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv; ${DEPTH}
        void main() {
          vec4 acc = vec4(0.0);
          for (int i = 0; i < 4; i++) {
            vec2 o = vec2(float(i - (i / 2) * 2) - 0.5, float(i / 2) - 0.5) * uTexel;
            float w = coc(vUv + o) + 0.002;
            acc += vec4(min(texture2D(tSrc, vUv + o).rgb, vec3(12.0)) * w, w);
          }
          gl_FragColor = acc * 0.25;
        }`,
    });
    this.mBlurW = new THREE.ShaderMaterial({
      ...base, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */ `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tSrc, vUv) * 0.2;
          for (int i = 1; i <= 4; i++) { float w = 0.2 - float(i) * 0.035; c += (texture2D(tSrc, vUv + uDir * float(i) * 1.25) + texture2D(tSrc, vUv - uDir * float(i) * 1.25)) * w; }
          gl_FragColor = c;
        }`,
    });
    this.mComp = new THREE.ShaderMaterial({
      ...base,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tBg: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, uBloomOn: { value: 0 },
        uRes: { value: new THREE.Vector2() }, uFrame: { value: 0 }, uTime: { value: 0 },
        uNear: { value: 0.1 }, uFar: { value: 50 }, uFocus: { value: 3 }, uRange: { value: 2 }, uNearBlur: { value: 0 }, uDof: { value: 1 },
        uExposure: { value: 1 }, uWarm: { value: 0.3 }, uSat: { value: 1.1 }, uCon: { value: 1.05 }, uVig: { value: 0.3 }, uGrain: { value: 0.03 }, uBloom: { value: 0.5 }, uFade: { value: 0 },
        uInkOn: { value: 0 }, ...inkUniforms(), // [outline9]
      },
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform sampler2D tBg; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform float uBloomOn;
        uniform vec2 uRes; uniform float uFrame; uniform float uTime; uniform float uDof;
        uniform float uExposure; uniform float uWarm; uniform float uSat; uniform float uCon; uniform float uVig; uniform float uGrain; uniform float uBloom; uniform float uFade;
        varying vec2 vUv;
        ${DEPTH}
        ${BAYER}
        uniform float uInkOn; ${INK_GLSL}
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main() {
          vec2 px = floor(vUv * uRes);
          vec2 uv = (px + 0.5) / uRes;
          vec3 col = texture2D(tColor, uv).rgb;
          float soft = 0.0;
          if (uDof > 0.0) {
            float c = coc(uv) * uDof;
            vec4 bg = texture2D(tBg, uv);
            vec3 blur = bg.a > 1e-4 ? bg.rgb / bg.a : col;
            soft = smoothstep(0.0, 1.0, c) * 0.92 * clamp(bg.a * 4.0, 0.0, 1.0);
            col = mix(col, blur, soft);
          }
          vec3 glow = vec3(0.0);
          if (uBloomOn > 0.5) { glow = (texture2D(tBloom, uv).rgb * 0.7 + texture2D(tBloom2, uv).rgb * 0.9) * uBloom; col += glow; }
          col *= uExposure;
          col = 0.18 * pow(max(col, vec3(1e-5)) / 0.18, vec3(uCon));
          col = aces(col * 0.85);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          // golden grade: warm, honeyed lights; cool, deep shadows; extra saturation in the mids
          col += uWarm * vec3(0.045, 0.018, -0.03) * smoothstep(0.2, 0.85, l);
          col += vec3(-0.012, 0.002, 0.02) * (1.0 - smoothstep(0.0, 0.3, l));
          col = max(col, 0.0);
          l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          vec2 cc = vUv - 0.5;
          col *= 1.0 - uVig * smoothstep(0.1, 0.75, dot(cc, cc) * 1.5);
          col = toSRGB(clamp(col, 0.0, 1.0));
          if (uInkOn > 0.5) { // [outline9] ink lines (faded where the background blurs and under bright bloom)
            float a = inkCover(uv);
            a *= (1.0 - smoothstep(0.25, 0.85, soft)) * (1.0 - smoothstep(0.35, 1.6, dot(glow, vec3(0.2126, 0.7152, 0.0722)) * uExposure));
            col = inkOver(col, a);
          }
          float g = hash(px + floor(uTime * 24.0) * 17.0) - 0.5;
          col += g * uGrain * (1.1 - l);
          col += (bayer4(px) - 0.5) / 255.0; // [light7] an 8-bit ordered dither against banding (no posterising)
          col = mix(col, vec3(0.0), uFade);
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
    });
    this.mBlit = new THREE.ShaderMaterial({ ...base, uniforms: { tSrc: { value: null } }, fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }' });
    this.quad = new THREE.Mesh(tri(), this.mBlit);
    this.quad.frustumCulled = false;
    this.passScene.add(this.quad);
    // what the app's renderer draws to the canvas: the finished low-res picture, blown up with nearest filtering
    const show = new THREE.Mesh(tri(), new THREE.ShaderMaterial({ ...base, uniforms: { tSrc: { value: this.ldr.texture } }, fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }' }));
    show.frustumCulled = false;
    this.showMat = show.material as THREE.ShaderMaterial;
    this.present.add(show);
  }
  private showMat: THREE.ShaderMaterial;
  /** 0..1 fade to black (handoffs) */
  fade = 0;

  resize(W: number, H: number) {
    // [light7] the full canvas resolution (the renderer's pixel ratio); the blur and bloom levels keep their size on
    // the screen whatever the ratio
    const pr = this.gl.getPixelRatio();
    this.px = 1 / pr;
    this.w = Math.max(64, Math.round(W * pr));
    this.h = Math.max(64, Math.round(H * pr));
    const { w, h } = this, k = pr >= 1.5 ? 1 : 0;
    this.rt.setSize(w, h);
    (this.rt.depthTexture as THREE.DepthTexture).image.width = w; (this.rt.depthTexture as THREE.DepthTexture).image.height = h;
    this.ldr.setSize(w, h);
    this.hA.setSize(w >> (1 + k), h >> (1 + k)); this.hB.setSize(w >> (1 + k), h >> (1 + k));
    this.qA.setSize(Math.max(8, w >> (2 + k)), Math.max(8, h >> (2 + k))); this.qB.setSize(Math.max(8, w >> (2 + k)), Math.max(8, h >> (2 + k)));
    this.eA.setSize(Math.max(8, w >> (3 + k)), Math.max(8, h >> (3 + k))); this.eB.setSize(Math.max(8, w >> (3 + k)), Math.max(8, h >> (3 + k)));
    this.ink.setSize(w, h); // [outline9]
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.passScene, this.cam);
  }

  /** Draw the office (and the overlay) into the finished picture; `present` then shows it. */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, time: number) {
    const gl = this.gl, g = this.grade, prev = gl.getRenderTarget(), auto = gl.autoClear;
    this.frame++;
    gl.autoClear = true;
    const pr = gl.getPixelRatio();
    this.ink.frame(this.w, this.h, this.outline, 1, pr, g.exposure); // [outline9]
    gl.setRenderTarget(this.rt);
    gl.clear();
    gl.render(scene, camera);
    Ink.idle(); // [outline9]
    gl.autoClear = false;
    const depthU = (m: THREE.ShaderMaterial) => {
      m.uniforms.tDepth.value = this.rt.depthTexture; m.uniforms.uNear.value = camera.near; m.uniforms.uFar.value = camera.far;
      m.uniforms.uFocus.value = g.focus; m.uniforms.uRange.value = g.range; m.uniforms.uNearBlur.value = g.nearBlur;
    };
    const blur = (mat: THREE.ShaderMaterial, a: THREE.WebGLRenderTarget, b: THREE.WebGLRenderTarget) => {
      mat.uniforms.tSrc.value = a.texture; mat.uniforms.uDir.value.set(1 / a.width, 0); this.pass(mat, b);
      mat.uniforms.tSrc.value = b.texture; mat.uniforms.uDir.value.set(0, 1 / a.height); this.pass(mat, a);
    };
    const u = this.mComp.uniforms;
    if (g.dof > 0.01) {
      this.mDown.uniforms.tSrc.value = this.rt.texture; depthU(this.mDown);
      this.mDown.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mDown, this.hA);
      blur(this.mBlurW, this.hA, this.hB);
      u.tBg.value = this.hA.texture;
    }
    if (this.bloomOn && g.bloom > 0.01) {
      this.mBright.uniforms.tSrc.value = this.rt.texture;
      this.mBright.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mBright, this.qA);
      blur(this.mBlur, this.qA, this.qB);
      this.mBlit.uniforms.tSrc.value = this.qA.texture;
      this.pass(this.mBlit, this.eA);
      blur(this.mBlur, this.eA, this.eB);
      u.tBloom.value = this.qA.texture; u.tBloom2.value = this.eA.texture; u.uBloomOn.value = 1;
    } else u.uBloomOn.value = 0;
    // [outline9] the ink mask
    if (this.outline.strength > 0.001 && inkDev.mode !== 'off') {
      this.ink.run(this.rt, camera, this.outline, 1, pr);
      u.tInk.value = this.ink.rt.texture; u.uInkTexel.value.set(1 / this.w, 1 / this.h); u.uInkStr.value = Math.min(1, this.outline.strength); u.uInkOn.value = 1;
    } else u.uInkOn.value = 0;
    u.tColor.value = this.rt.texture; depthU(this.mComp);
    u.uDof.value = g.dof;
    u.uRes.value.set(this.w, this.h); u.uFrame.value = this.frame % 1000; u.uTime.value = time;
    u.uExposure.value = g.exposure; u.uWarm.value = g.warm; u.uSat.value = g.sat; u.uCon.value = g.contrast; u.uVig.value = g.vignette; u.uGrain.value = g.grain; u.uBloom.value = g.bloom; u.uFade.value = this.fade;
    this.pass(this.mComp, this.ldr);
    // the overlay (Pip's words) goes on crisp, after the grade
    if (this.overlay.children.length) {
      gl.setRenderTarget(this.ldr);
      gl.clearDepth();
      gl.render(this.overlay, camera);
    }
    gl.setRenderTarget(prev);
    gl.autoClear = auto;
    this.showMat.uniforms.tSrc.value = this.ldr.texture;
  }

  dispose() {
    for (const t of [this.rt, this.ldr, this.hA, this.hB, this.qA, this.qB, this.eA, this.eB]) t.dispose();
    this.ink.dispose(); // [outline9]
    for (const m of [this.mBright, this.mBlur, this.mDown, this.mBlurW, this.mComp, this.mBlit, this.showMat]) m.dispose();
  }
}
