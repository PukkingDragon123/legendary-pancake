// [look4] "Golden Diorama", [light7] rendered at full resolution: the picture for every scene the app draws (the forest
// and every Stage: the shop...). The world is drawn into an HDR target the size of the canvas (multisampled on the
// high and medium tiers; the low tier draws at about two thirds of the size and scales up smoothly), then
//   1. bloom: a soft-knee bright pass at half resolution and a down/up mip chain (lamp windows, the sun and its glints,
//      the moon, fireflies and lanterns glow with a clean halo),
//   2. tilt-shift depth of field from the depth buffer: a sharp band round the focus distance, the far woods and
//      the near grass softly out of focus (colour weighted by circle of confusion, so sharp things never smear),
//   3. [outline9] ink: crisp warm near-black outlines from the depth and each material's ink class (src/gfx/ink.ts):
//      silhouettes, depth steps and creases on solid things, only the outer edge of leaf cards, none on the sky, glows,
//      glass, grass or particles; thinning out with distance; the owls' fluff outlined by their ink hulls,
//   4. a composite straight onto the canvas: exposure, white balance, ACES filmic tone mapping, a grade that adds
//      warmth, vibrance and saturation, warm-light / cool-shadow split toning, lift/gamma/gain, a gentle vignette,
//      the ink lines (faded where the depth of field blurs and under bright bloom), a whisper of film grain and an
//      8-bit ordered dither (only against banding).
// Knobs: `post.grade` (the world's live values, driven by the scene from the sky) and `Stage.look` (see
// scene.ts): a stage sets any subset of Grade and the rest falls back to STAGE_LOOK.
import * as THREE from 'three';
import { Ink, inkDev, INK_GLSL, inkUniforms, type InkLook } from '../gfx/ink.ts';

export interface Grade {
  /** linear exposure before tone mapping */
  exposure: number;
  /** contrast around mid grey (1 = neutral) */
  contrast: number;
  /** global saturation (1 = neutral) */
  saturation: number;
  /** [look12] the saturation of orange-brown hues instead (warm wood, floorboards, leather): a little less than
   * `saturation` keeps honey wood from reading orange under warm light (1 = neutral) */
  orange: number;
  /** extra saturation for the less saturated colours (0 = off) */
  vibrance: number;
  /** white balance: + warm (amber), - cool (blue) */
  warm: number;
  lift: THREE.Vector3; gamma: THREE.Vector3; gain: THREE.Vector3;
  /** split toning strength: warm highlights, cool shadows */
  split: number;
  vignette: number;
  grain: number;
  /** bloom strength (0 = off) */
  bloom: number;
  /** linear brightness where bloom starts (soft knee below it) */
  bloomThreshold: number;
  /** depth of field: focus distance in world units along the view; <= 0 focuses on whatever is at `focusAt` */
  focus: number;
  /** half-width of the sharp band (world units) */
  focusRange: number;
  /** depth-of-field strength 0..1 (0 = everything sharp) */
  blur: number;
  /** where auto focus looks (uv, 0..1) */
  focusAt: THREE.Vector2;
  /** cold weather cast (snow), 0..1 */
  cold: number;
  /** @deprecated kept for older callers; the picture is no longer posterised */
  quant: number;
  /** [outline9] ink outlines: opacity 0..1 (0 = off) */
  outline: number;
  /** [outline9] ink line weight multiplier (1 = about 1.7 device px on a 1x screen, 2.3 on a 2x one) */
  outlineWidth: number;
  /** [outline9] 0..1 strength of the inner lines (creases); silhouettes and depth steps are always drawn */
  outlineCrease: number;
  /** [outline9] view distance (world units) where the lines have faded out (they start thinning at 40% of it) */
  outlineFar: number;
  /** camera motion blur: the shutter as a fraction of a frame (0 = off, 0.5 = a film camera's 180 degree shutter) */
  motionBlur: number;
}

export function defaultGrade(): Grade {
  return {
    exposure: 1, contrast: 1.06, saturation: 1.2, vibrance: 0.34, warm: 0.07, // [look12] fuller colour, cosy but not orange
    lift: new THREE.Vector3(0, 0, 0), gamma: new THREE.Vector3(1, 1, 1), gain: new THREE.Vector3(1, 1, 1),
    split: 0.3, vignette: 0.22, grain: 0.018, bloom: 0.55, bloomThreshold: 1.0,
    focus: 0, focusRange: 6, blur: 0.6, focusAt: new THREE.Vector2(0.5, 0.5), cold: 0, quant: 255, orange: 1.04,
    outline: 1, outlineWidth: 1, outlineCrease: 1, outlineFar: 80, motionBlur: 0.5,
  };
}

/** What a Stage gets unless it sets its own `look` (warm, softly bloomed, auto-focused at the centre). */
export const STAGE_LOOK: Partial<Grade> = {
  exposure: 1.0, contrast: 1.06, saturation: 1.18, vibrance: 0.32, warm: 0.05, split: 0.3, vignette: 0.24, grain: 0.016, // [look12]
  bloom: 0.5, bloomThreshold: 1.2, focus: 0, focusRange: 1.5, blur: 0.3, cold: 0, orange: 1.0,
  outline: 1, outlineWidth: 1, outlineCrease: 1, outlineFar: 40,
};

/**
 * [clock14] Natural colour. Every scene's grade (the sky-driven world grade and each stage's look) was tuned for a
 * stylised, saturated picture: on real materials that read as a white-washed, oversaturated haze (lifted blacks, a
 * wide bloom veil, split toning tinting everything, saturation and vibrance stacked on ACES). The composite keeps each
 * look's intent (warmer at golden hour, cooler at night, a stage's own warmth) but at a natural strength: colour near
 * neutral, real contrast and deep shadows, bloom only on what is really bright, black stays black, thin dark ink.
 * Dev: `?real=0` in the URL shows the old look (A/B).
 */
export const REALISM = {
  on: !(typeof location !== 'undefined' && /[?&]real=0\b/.test(location.search)),
  /** fraction of each look's saturation / vibrance / split toning / white balance / lift that is kept */
  sat: 0.22, vib: 0.15, split: 0.3, warm: 0.6, lift: 0.2,
  /** added contrast round mid grey, bloom kept, bloom threshold multiplier */
  contrast: 0.07, bloom: 0.6, thresh: 1.3,
  /** ink: opacity, line width and crease strength multipliers (thin dark edges, not cartoon lines) */
  ink: 0.7, inkWidth: 0.6, crease: 0.35, grain: 0.6,
};

/** Knobs a Stage may set (any subset of Grade). */
export type Look = Partial<Omit<Grade, 'lift' | 'gamma' | 'gain' | 'focusAt'>> & { focusAt?: [number, number] };

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BAYER = /* glsl */ `
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x) + int(q.y) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[i] + 0.5) / 16.0;
}`;
const DEPTH = /* glsl */ `
uniform sampler2D tDepth; uniform float uNear; uniform float uFar;
float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return (uNear * uFar) / ((uFar - uNear) * d - uFar) * -1.0;
}`;

function quad(mat: THREE.Material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
}
const shader = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });

/** [light7] Per tier: the scene target's size relative to the canvas, and its multisampling. */
const RES = { high: 1, medium: 1, low: 0.68 } as const;
const MSAA = { high: 4, medium: 2, low: 0 } as const;

export class Post {
  /** canvas pixels per scene-target pixel (1 on high and medium) */
  pixel = 1;
  /** the world's grade (the scene drives it from the sky every frame) */
  grade = defaultGrade();
  private stageGrade = defaultGrade();
  enabled = true;
  private rt!: THREE.WebGLRenderTarget;
  /** the scene after camera motion blur (when the camera moves) */
  private mbRT!: THREE.WebGLRenderTarget;
  private mMotion: THREE.ShaderMaterial;
  private prevVP = new THREE.Matrix4();
  private curVP = new THREE.Matrix4();
  private invVP = new THREE.Matrix4();
  private prevCam: THREE.Camera | null = null;
  private lastT = 0;
  private bloomRT: THREE.WebGLRenderTarget[] = [];
  private dofA!: THREE.WebGLRenderTarget;
  private dofB!: THREE.WebGLRenderTarget;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private quadMesh: THREE.Mesh;
  private mBright: THREE.ShaderMaterial;
  private mDown: THREE.ShaderMaterial;
  private mCoc: THREE.ShaderMaterial;
  private mDofBlur: THREE.ShaderMaterial;
  private mComp: THREE.ShaderMaterial;
  private w = 1; private h = 1; private frame = 0;
  private levels: number;
  private fixedPixel: number | null = null;
  /** [outline9] the edge pass */
  private ink: Ink;
  private inkLook: InkLook = { strength: 1, width: 1, crease: 1, far: 80 };

  /** [light7] cost tier: high (full size, 4x MSAA, 6 bloom levels), medium (full size, 2x MSAA, 5 levels), low (about
   * two thirds of the size scaled up smoothly, no MSAA, 4 levels); depth of field at a quarter of the target on all */
  private tier: 'high' | 'medium' | 'low';
  private dofShift = 1;
  constructor(private gl: THREE.WebGLRenderer, quality: 'low' | 'high' | 'medium') {
    this.tier = quality;
    this.levels = quality === 'high' ? 6 : quality === 'medium' ? 5 : 4;
    this.dofShift = 2;
    this.ink = new Ink(gl, quality);
    // camera motion blur: each pixel's world point from the depth, where it was on screen last frame, and samples along
    // the path between (the sky and far hills streak when the camera turns, the near things when it travels)
    this.mMotion = shader(/* glsl */ `
      uniform sampler2D tSrc; uniform sampler2D tDepth; uniform mat4 uInvVP; uniform mat4 uPrevVP; uniform float uAmt; uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        float d = texture2D(tDepth, vUv).x;
        vec4 w = uInvVP * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); w /= w.w;
        vec4 pc = uPrevVP * w;
        vec2 v = (vUv - (pc.xy / pc.w * 0.5 + 0.5)) * uAmt;
        float L = length(v), maxL = 0.04;
        if (pc.w <= 0.0) v = vec2(0.0); else if (L > maxL) v *= maxL / L;
        vec3 c0 = texture2D(tSrc, vUv).rgb;
        if (length(v / uTexel) < 0.75) { gl_FragColor = vec4(c0, 1.0); return; }
        vec3 acc = vec3(0.0); float ws = 0.0;
        for (int i = 0; i < 12; i++) {
          float t = float(i) / 11.0 - 0.5, wt = 1.0 - abs(t);
          acc += min(texture2D(tSrc, vUv + v * t).rgb, vec3(24.0)) * wt; ws += wt;
        }
        gl_FragColor = vec4(acc / ws, 1.0);
      }`, { tSrc: { value: null }, tDepth: { value: null }, uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() }, uAmt: { value: 0.5 }, uTexel: { value: new THREE.Vector2() } });
    this.mBright = shader(/* glsl */ `
      uniform sampler2D tSrc; uniform float uThresh; uniform vec2 uTexel; varying vec2 vUv;
      vec3 tap(vec2 o) { return min(texture2D(tSrc, vUv + o * uTexel).rgb, vec3(64.0)); }
      float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main() {
        // 4 taps with a Karis average, so single hot pixels don't flicker
        vec3 a = tap(vec2(-0.5, -0.5)), b = tap(vec2(0.5, -0.5)), c = tap(vec2(-0.5, 0.5)), d = tap(vec2(0.5, 0.5));
        float wa = 1.0 / (1.0 + luma(a)), wb = 1.0 / (1.0 + luma(b)), wc = 1.0 / (1.0 + luma(c)), wd = 1.0 / (1.0 + luma(d));
        vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
        float l = max(col.r, max(col.g, col.b));
        float knee = uThresh * 0.6;
        float s = clamp(l - uThresh + knee, 0.0, 2.0 * knee);
        s = s * s / (4.0 * knee + 1e-4);
        gl_FragColor = vec4(col * max(s, l - uThresh) / max(l, 1e-4), 1.0);
      }`, { tSrc: { value: null }, uThresh: { value: 1 }, uTexel: { value: new THREE.Vector2() } });
    // 13-tap downsample (Jimenez 2014); the 9-tap tent upsample is mUpAdd
    this.mDown = shader(/* glsl */ `
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
      void main() {
        vec3 c = s(vec2(0.0)) * 0.125;
        c += (s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0))) * 0.125;
        c += (s(vec2(-2.0, -2.0)) + s(vec2(2.0, -2.0)) + s(vec2(-2.0, 2.0)) + s(vec2(2.0, 2.0))) * 0.03125;
        c += (s(vec2(-2.0, 0.0)) + s(vec2(2.0, 0.0)) + s(vec2(0.0, -2.0)) + s(vec2(0.0, 2.0))) * 0.0625;
        gl_FragColor = vec4(c, 1.0);
      }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    // circle of confusion and the CoC-weighted half-resolution colour for the depth of field
    const dofU = () => ({
      uFocus: { value: 10 }, uRange: { value: 4 }, uNear: { value: 0.1 }, uFar: { value: 100 }, uFocusAt: { value: new THREE.Vector2(0.5, 0.5) },
      tDepth: { value: null as THREE.Texture | null },
    });
    const COC = /* glsl */ `
      uniform float uFocus; uniform float uRange; uniform vec2 uFocusAt;
      ${DEPTH}
      // auto focus: the nearest solid thing in a small cross round focusAt (never the sky)
      float focusZ() {
        if (uFocus > 0.0) return uFocus;
        float best = -1.0;
        for (int i = 0; i < 5; i++) {
          vec2 o = i == 0 ? vec2(0.0) : vec2(i == 1 ? 0.04 : i == 2 ? -0.04 : 0.0, i == 3 ? 0.05 : i == 4 ? -0.05 : 0.0);
          vec2 uv = clamp(uFocusAt + o, 0.0, 1.0);
          if (texture2D(tDepth, uv).x > 0.99999) continue;
          float z = viewZ(uv);
          best = best < 0.0 ? z : min(best, z);
        }
        return best;
      }
      float coc(vec2 uv, float fz) {
        if (fz <= 0.0) return 0.0;
        float d = texture2D(tDepth, uv).x;
        if (d > 0.99999) return 0.0; // the sky stays crisp (stars, the moon, painted clouds)
        float z = viewZ(uv);
        float dz = z - fz;
        float far = clamp((dz - uRange) / (fz * 1.6 + uRange), 0.0, 1.0);
        float near = clamp((-dz - uRange) / (fz * 0.6 + uRange * 0.5), 0.0, 1.0);
        return max(far, near * 0.6);
      }`;
    this.mCoc = shader(/* glsl */ `
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      ${COC}
      void main() {
        float fz = focusZ();
        vec4 acc = vec4(0.0);
        for (int i = 0; i < 4; i++) {
          vec2 o = vec2(float(i - (i / 2) * 2), float(i / 2)) - 0.5;
          vec2 uv = vUv + o * uTexel;
          float k = coc(uv, fz);
          float w = 0.02 + k;
          acc += vec4(min(texture2D(tSrc, uv).rgb, vec3(16.0)) * w, w);
        }
        gl_FragColor = acc * 0.25;
      }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, ...dofU() });
    this.mDofBlur = shader(/* glsl */ `
      uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main() {
        vec4 s = texture2D(tSrc, vUv) * 0.2;
        s += (texture2D(tSrc, vUv + uDir * 1.0) + texture2D(tSrc, vUv - uDir * 1.0)) * 0.17;
        s += (texture2D(tSrc, vUv + uDir * 2.0) + texture2D(tSrc, vUv - uDir * 2.0)) * 0.12;
        s += (texture2D(tSrc, vUv + uDir * 3.0) + texture2D(tSrc, vUv - uDir * 3.0)) * 0.07;
        s += (texture2D(tSrc, vUv + uDir * 4.0) + texture2D(tSrc, vUv - uDir * 4.0)) * 0.04;
        gl_FragColor = s;
      }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mComp = shader(/* glsl */ `
      uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tDof;
      uniform float uBloomOn; uniform float uDofOn; uniform float uBlur;
      uniform vec2 uRes; uniform float uFrame; uniform float uTime;
      uniform float uExposure; uniform float uCon; uniform float uSat; uniform float uOrange; uniform float uVib; uniform float uWarm; uniform float uSplit;
      uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain;
      uniform float uVig; uniform float uGrain; uniform float uBloom; uniform float uCold;
      uniform float uInkOn;
      varying vec2 vUv;
      ${COC}
      ${BAYER}
      ${INK_GLSL}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }
      // ACES filmic (Hill's RRT + ODT fit), as three.js does it
      vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c) {
        const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        c = IN * (c / 0.6);
        c = OUT * rrt(c);
        return clamp(c, 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main() {
        vec2 px = gl_FragCoord.xy;
        vec2 uv = vUv;
        vec3 col = texture2D(tColor, uv).rgb;
        float soft = 0.0, inkSoft = 0.0;
        if (uDofOn > 0.5) {
          float k = coc(uv, focusZ()) * uBlur;
          vec4 d = texture2D(tDof, uv);
          vec3 sc = d.rgb / max(d.a, 1e-4);
          soft = smoothstep(0.0, 0.55, k) * step(1e-3, d.a);
          inkSoft = smoothstep(0.0, 0.55, k); // [look12] (from this pixel alone: the quarter-size blur mask broke lines into dashes)
          col = mix(col, sc, soft);
        }
        vec3 glow = vec3(0.0);
        if (uBloomOn > 0.5) { glow = texture2D(tBloom, uv).rgb * uBloom; col += glow; }
        col *= uExposure;
        // white balance: warm days and lamplight, cool when negative
        col *= vec3(1.0 + uWarm * 0.16, 1.0 + uWarm * 0.03, 1.0 - uWarm * 0.16);
        col = 0.18 * pow(max(col, vec3(1e-6)) / 0.18, vec3(uCon));
        col = aces(col);
        // grade in display space: lift / gamma / gain
        col = pow(max(col, 0.0), 1.0 / uGamma);
        col = col * uGain + uLift * (1.0 - col);
        float l = luma(col);
        // split toning: warm honey in the lights, a cool blue-green in the shadows (adds colour, never greys)
        col += uSplit * vec3(0.045, 0.02, -0.04) * smoothstep(0.35, 0.95, l);
        col += uSplit * vec3(-0.025, 0.004, 0.03) * (1.0 - smoothstep(0.02, 0.4, l)) * smoothstep(0.0, 0.08, l);
        col = max(col, 0.0);
        // vibrance then saturation
        l = luma(col);
        float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
        // [look12] orange-browns (red over green over blue, green about half way) get their own saturation
        float hO = step(col.b, col.g) * step(col.g, col.r) * clamp(1.0 - abs((col.g - col.b) / max(col.r - col.b, 1e-4) - 0.45) * 2.6, 0.0, 1.0) * smoothstep(0.04, 0.16, sat);
        col = mix(vec3(l), col, 1.0 + uVib * (1.0 - sat) * (1.0 - smoothstep(0.85, 1.0, l)) * (1.0 - 0.7 * hO));
        col = mix(vec3(l), col, mix(uSat, uOrange, hO));
        vec2 cc = vUv - 0.5;
        float r2 = dot(cc * vec2(uRes.x / uRes.y, 1.0), cc * vec2(uRes.x / uRes.y, 1.0)) / max(1.0, uRes.x / uRes.y);
        col = mix(col, mix(vec3(l), col, 0.75) * vec3(0.94, 0.98, 1.05), uCold * 0.6);
        col *= 1.0 - uVig * smoothstep(0.1, 0.62, r2);
        col = toSRGB(clamp(col, 0.0, 1.0));
        // [outline9] the ink lines: out-of-focus things lose them with their sharpness, lamps glow over them
        if (uInkOn > 0.5) {
          float a = inkCover(uv);
          a *= (1.0 - smoothstep(0.3, 0.95, inkSoft)) * (1.0 - smoothstep(0.35, 1.6, luma(glow) * uExposure));
          col = inkOver(col, a);
          if (uInkOn > 1.5) col = mix(col, vec3(1.0 - inkCover(uv)), 0.85); // dev: ?ink=mask
        }
        float g = hash(px + floor(uTime * 24.0) * 17.0) - 0.5;
        col += g * uGrain * (1.1 - l);
        // 8-bit ordered dither: smooth skies without banding
        col += (bayer4(px) - 0.5) / 255.0;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`, {
      tColor: { value: null }, tBloom: { value: null }, tDof: { value: null }, uBloomOn: { value: 0 }, uDofOn: { value: 0 }, uBlur: { value: 0 },
      uRes: { value: new THREE.Vector2() }, uFrame: { value: 0 }, uTime: { value: 0 },
      uExposure: { value: 1 }, uCon: { value: 1 }, uSat: { value: 1 }, uOrange: { value: 1 }, uVib: { value: 0 }, uWarm: { value: 0 }, uSplit: { value: 0 },
      uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uVig: { value: 0 }, uGrain: { value: 0 }, uBloom: { value: 0 }, uCold: { value: 0 },
      uInkOn: { value: 0 }, ...inkUniforms(),
      ...dofU(),
    });
    this.quadMesh = quad(this.mComp);
    this.scene.add(this.quadMesh);
    this.resize(innerWidth, innerHeight);
  }

  /** The scene target's resolution. */
  get size(): [number, number] { return [this.w, this.h]; }

  /** [look4] Change the cost tier at runtime (re-allocates the small targets; cheap). */
  setTier(t: 'high' | 'medium' | 'low') {
    if (t === this.tier) return;
    this.tier = t;
    this.levels = t === 'high' ? 6 : t === 'medium' ? 5 : 4;
    this.dofShift = 2;
    this.ink.setTier(t);
    this.w = -1;
    this.resize(this.cssW, this.cssH);
  }

  /** Force a scale (canvas px per scene-target px); null returns to the tier's. */
  setPixel(p: number | null) {
    if (p === this.fixedPixel) return;
    this.fixedPixel = p;
    this.resize(this.cssW, this.cssH);
  }

  private cssW = 1; private cssH = 1;
  /** [light7] Size the targets for a canvas of W x H CSS px (at the renderer's pixel ratio). */
  resize(W: number, H: number) {
    this.cssW = W; this.cssH = H;
    const pr = this.gl.getPixelRatio();
    this.pixel = this.fixedPixel ?? 1 / RES[this.tier];
    const w = Math.max(64, Math.round((W * pr) / this.pixel)), h = Math.max(64, Math.round((H * pr) / this.pixel));
    if (this.rt && w === this.w && h === this.h && this.rt.samples === MSAA[this.tier]) return;
    this.w = w; this.h = h;
    for (const t of [this.rt, this.mbRT, this.dofA, this.dofB, ...this.bloomRT]) t?.dispose();
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    depth.minFilter = depth.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthTexture: depth, samples: MSAA[this.tier] });
    const mk = (a: number, b: number) => new THREE.WebGLRenderTarget(Math.max(4, a), Math.max(4, b), { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.mbRT = mk(w, h);
    // bloom works from half resolution down; the depth of field from a quarter
    this.bloomRT = [];
    for (let i = 1; i <= this.levels; i++) this.bloomRT.push(mk(w >> i, h >> i));
    const dd = this.dofShift;
    this.dofA = mk(w >> dd, h >> dd); this.dofB = mk(w >> dd, h >> dd);
    this.ink.setSize(w, h);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quadMesh.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.scene, this.cam);
  }

  /** Draw a scene through the chain onto the canvas. `look` overrides the world grade (stages). */
  render(scene: THREE.Scene, camera: THREE.Camera, time: number, look?: Look | null) {
    const gl = this.gl;
    if (!this.enabled) { gl.setRenderTarget(null); gl.render(scene, camera); return; }
    this.frame++;
    const g = look ? resolveLook(look, this.stageGrade) : this.grade;
    // [outline9] ink for this picture (a stage's own finished picture, e.g. the office's, opts out with userData.noInk)
    const L = this.inkLook, pr = gl.getPixelRatio();
    const R = REALISM.on ? REALISM : null;
    L.strength = scene.userData.noInk || inkDev.mode === 'off' ? 0 : g.outline * (R ? R.ink : 1); L.width = g.outlineWidth * (R ? R.inkWidth : 1); L.crease = g.outlineCrease * (R ? R.crease : 1); L.far = g.outlineFar;
    this.ink.frame(this.w, this.h, L, this.pixel, pr, g.exposure);
    gl.setRenderTarget(this.rt);
    gl.clear();
    gl.render(scene, camera);
    Ink.idle();
    // ---- camera motion blur (only while the camera really moves; a cut or a new camera starts clean)
    let src = this.rt;
    camera.updateMatrixWorld();
    this.curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const now = performance.now(), gap = now - this.lastT;
    this.lastT = now;
    if (g.motionBlur > 0.01 && this.prevCam === camera && gap < 250 && !matNear(this.curVP, this.prevVP)) {
      const mu = this.mMotion.uniforms;
      mu.tSrc.value = this.rt.texture; mu.tDepth.value = this.rt.depthTexture;
      mu.uInvVP.value.copy(this.invVP.copy(this.curVP).invert()); mu.uPrevVP.value.copy(this.prevVP);
      mu.uAmt.value = g.motionBlur; mu.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mMotion, this.mbRT);
      src = this.mbRT;
    }
    this.prevVP.copy(this.curVP);
    this.prevCam = camera;
    const u = this.mComp.uniforms;
    if (L.strength > 0.001) {
      this.ink.run(this.rt, camera, L, this.pixel, pr);
      u.tInk.value = this.ink.rt.texture; u.uInkTexel.value.set(1 / this.w, 1 / this.h); u.uInkStr.value = Math.min(1, L.strength); u.uInkOn.value = inkDev.mode === 'mask' ? 2 : 1;
    } else u.uInkOn.value = 0;
    // ---- bloom
    if (g.bloom > 0.001) {
      const B = this.bloomRT;
      this.mBright.uniforms.tSrc.value = src.texture;
      this.mBright.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
      this.mBright.uniforms.uThresh.value = g.bloomThreshold * (R ? R.thresh : 1);
      this.pass(this.mBright, B[0]);
      for (let i = 1; i < B.length; i++) {
        this.mDown.uniforms.tSrc.value = B[i - 1].texture;
        this.mDown.uniforms.uTexel.value.set(1 / B[i - 1].width, 1 / B[i - 1].height);
        this.pass(this.mDown, B[i]);
      }
      // upsample: each level adds its tent-filtered wider neighbour, from the smallest up
      for (let i = B.length - 1; i > 0; i--) this.mUpAdd(B[i], B[i - 1]);
      u.tBloom.value = B[0].texture; u.uBloomOn.value = 1;
    } else u.uBloomOn.value = 0;
    // ---- depth of field
    const cam = camera as THREE.PerspectiveCamera;
    const dofOn = g.blur > 0.01 && cam.isPerspectiveCamera;
    for (const m of [this.mCoc, this.mComp]) {
      const cu = m.uniforms;
      cu.tDepth.value = this.rt.depthTexture;
      cu.uNear.value = cam.near ?? 0.1; cu.uFar.value = cam.far ?? 100;
      cu.uFocus.value = g.focus; cu.uRange.value = g.focusRange; cu.uFocusAt.value.copy(g.focusAt);
    }
    if (dofOn) {
      this.mCoc.uniforms.tSrc.value = src.texture;
      this.mCoc.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mCoc, this.dofA);
      const step = 0.6 + g.blur * 1.1;
      this.mDofBlur.uniforms.tSrc.value = this.dofA.texture; this.mDofBlur.uniforms.uDir.value.set(step / this.dofA.width, 0); this.pass(this.mDofBlur, this.dofB);
      this.mDofBlur.uniforms.tSrc.value = this.dofB.texture; this.mDofBlur.uniforms.uDir.value.set(0, step / this.dofA.height); this.pass(this.mDofBlur, this.dofA);
      u.tDof.value = this.dofA.texture;
    }
    u.uDofOn.value = dofOn ? 1 : 0; u.uBlur.value = Math.min(1, g.blur) * 1.4;
    // ---- composite
    u.tColor.value = src.texture;
    u.uRes.value.set(this.w, this.h); u.uFrame.value = this.frame % 1000; u.uTime.value = time;
    const nat = (v: number, k: number) => (R ? 1 + (v - 1) * k : v);
    u.uExposure.value = g.exposure; u.uCon.value = g.contrast + (R ? R.contrast : 0); u.uSat.value = nat(g.saturation, R?.sat ?? 1); u.uOrange.value = nat(g.orange, R?.sat ?? 1);
    u.uVib.value = g.vibrance * (R ? R.vib : 1); u.uWarm.value = g.warm * (R ? R.warm : 1); u.uSplit.value = g.split * (R ? R.split : 1);
    u.uLift.value.copy(g.lift).multiplyScalar(R ? R.lift : 1); u.uGamma.value.copy(g.gamma); u.uGain.value.copy(g.gain);
    u.uVig.value = g.vignette; u.uGrain.value = g.grain * (R ? R.grain : 1); u.uBloom.value = g.bloom * 0.12 * (R ? R.bloom : 1); u.uCold.value = g.cold;
    this.pass(this.mComp, null);
  }

  private upAdd: THREE.ShaderMaterial | null = null;
  /** add the tent-upsampled `src` onto `dst` (additive blending, so no read/write of the same target) */
  private mUpAdd(src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget) {
    if (!this.upAdd) {
      this.upAdd = shader(/* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
        vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
        void main() {
          vec3 c = s(vec2(0.0)) * 4.0;
          c += (s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)) + s(vec2(0.0, 1.0))) * 2.0;
          c += s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
          gl_FragColor = vec4(c / 16.0, 1.0);
        }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
      this.upAdd.blending = THREE.AdditiveBlending;
      this.upAdd.transparent = true;
    }
    this.upAdd.uniforms.tSrc.value = src.texture;
    this.upAdd.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    const ac = this.gl.autoClear;
    this.gl.autoClear = false;
    this.pass(this.upAdd, dst);
    this.gl.autoClear = ac;
  }

  dispose() { for (const t of [this.rt, this.mbRT, this.dofA, this.dofB, ...this.bloomRT]) t.dispose(); this.ink.dispose(); }
}

/** two view-projections close enough that nothing on screen moved by more than a fraction of a pixel */
function matNear(a: THREE.Matrix4, b: THREE.Matrix4) {
  const x = a.elements, y = b.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(x[i] - y[i]) > 1e-5 * (1 + Math.abs(x[i]))) return false;
  return true;
}

/** A stage's look over the stage defaults (lift/gamma/gain stay neutral). */
const NEUTRAL = defaultGrade();
function resolveLook(look: Look, g: Grade): Grade {
  Object.assign(g, NEUTRAL, STAGE_LOOK, { lift: g.lift.copy(NEUTRAL.lift), gamma: g.gamma.copy(NEUTRAL.gamma), gain: g.gain.copy(NEUTRAL.gain), focusAt: g.focusAt.copy(NEUTRAL.focusAt) });
  for (const [k, v] of Object.entries(look)) {
    if (v === undefined || k === 'focusAt') continue;
    (g as unknown as Record<string, unknown>)[k] = v;
  }
  if (look.focusAt) g.focusAt.set(look.focusAt[0], look.focusAt[1]);
  g.cold = look.cold ?? 0;
  return g;
}
