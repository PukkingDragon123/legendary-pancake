// [outline9] Ink: crisp, warm near-black outlines (#140c10) on everything the 3D views draw.
//
// One screen-space pass per frame (post.ts for the world and every stage, onboard/look.ts for the office), no extra
// geometry pass:
//   1. every opaque built-in material writes an ink class into the (otherwise unused) alpha of the HDR scene target,
//      through one patch of three's `opaque_fragment` chunk (installed when this module loads):
//        full (.25) silhouettes, depth steps and creases: furniture, the oak, props, characters, terrain, rocks
//        sil  (.5)  only an outer silhouette against something well behind it: leaf cards and other alpha-cut,
//                   double-sided cards (so a crown's inside never turns to scribble)
//        none (1)   nothing: unlit materials (window views, bulbs, glows), every ShaderMaterial (sky, grass, water,
//                   litter, far ridges, particles), the cleared background, and (in proportion) anything translucent
//                   blended over them (glass, smoke)
//      Additive glows add 1 to the alpha per layer (they write alpha 1), so a class is read from the fraction above 1:
//      a light shaft over a wall keeps the wall's lines. A material can override its class with inkMaterial().
//   2. the edge pass (Ink.run, at the scene target's size) reads the depth and the class and marks the near side of
//      every depth step (a 3-point second difference of 1/z, so receding floors and walls never trigger), with a
//      second ring 2 px out for line weight on high-density screens, and creases (the bend between view-space
//      tangents across a pixel) where all four neighbours are solid. It fades with distance (lines thin out and go
//      before the far woods could turn to mush) and close to the near plane.
//      Like a drawn line, the weight varies: heavier on the shadow side (outside towards the lower right, away from the
//      key light), on near things and with a slow pen pressure anchored in the world (so nothing crawls).
//   3. the composite samples that mask with a 3x3 tent and maps it through a soft threshold: anti-aliased lines about
//      1.7 device px wide on a 1x screen and 2.3 on a 2x one (creases thinner), laid over the graded picture in the ink
//      colour (with a breath of the colour under it), faded where the depth of field blurs and under bright bloom
//      (lamps glow over their lines).
// The owls' fluff would give a noisy, crawling contour, so fluff shells draw no ink and each furry part gets an
// inverted hull instead (inkHull): its back faces pushed out to the fluff's outer edge and then a constant number of
// pixels on screen, drawing only that last band (a clean silhouette line that the longest strands cross over).
// Cost tiers: high (8 + 4 depth taps, creases), medium (4 + 4, creases), low (4 taps, silhouettes only).
import * as THREE from 'three';

/** Dev: `?ink=0` in the URL draws no outlines (A/B), `?ink=mask` shows the edge mask (post.ts); live-editable. */
export const inkDev: { mode: '' | 'off' | 'mask' } = {
  mode: typeof location === 'undefined' ? '' : /[?&]ink=0\b/.test(location.search) ? 'off' : /[?&]ink=mask\b/.test(location.search) ? 'mask' : '',
};

/** The ink colour (display sRGB). */
export const INK_HEX = 0x140c10;
export type InkKind = 'full' | 'sil' | 'none';
const CODE: Record<InkKind, string> = { full: '0.25', sil: '0.5', none: '1.0' };

// ------------------------------------------------------------------ the class each material writes

const OPAQUE_INK = /* glsl */ `
#if defined( OPAQUE ) && !defined( USE_TRANSMISSION )
#ifndef HH_INK
#if defined( HH_UNLIT )
#define HH_INK 1.0
#elif defined( USE_ALPHATEST ) && defined( DOUBLE_SIDED )
#define HH_INK 0.5
#else
#define HH_INK 0.25
#endif
#endif
gl_FragColor.a = HH_INK;
#endif
`;
const UNLIT = ['basic', 'points', 'sprite'] as const;
let installed = false;
/** Patch three's shaders so opaque materials write their ink class (idempotent; runs on import). */
export function installInk(): void {
  if (installed) return;
  installed = true;
  const SC = THREE.ShaderChunk as unknown as Record<string, string> & { __hhInkOrig?: string };
  const orig = (SC.__hhInkOrig ??= SC.opaque_fragment);
  SC.opaque_fragment = orig + OPAQUE_INK;
  for (const id of UNLIT) {
    const lib = THREE.ShaderLib[id];
    if (lib && !lib.fragmentShader.startsWith('#define HH_UNLIT')) lib.fragmentShader = '#define HH_UNLIT\n' + lib.fragmentShader;
  }
}
installInk();

/** Set a material's ink class (a compile-time define; recompiles once if it changed). Call before it first draws. */
export function inkMaterial<M extends THREE.Material>(m: M, kind: InkKind): M {
  const d = (m.defines ??= {}) as Record<string, string>;
  if (d.HH_INK !== CODE[kind]) { d.HH_INK = CODE[kind]; m.needsUpdate = true; }
  return m;
}

// ------------------------------------------------------------------ knobs

export interface InkLook {
  /** 0..1 opacity of the lines (0 = off) */
  strength: number;
  /** line weight multiplier (1 = about 1.7 device px on a 1x screen, 2.3 on a 2x one) */
  width: number;
  /** 0..1 strength of the inner lines (creases between faces); silhouettes and depth steps are always drawn */
  crease: number;
  /** view distance where the lines are gone (they start thinning at 40% of it) */
  far: number;
}
export type InkTier = 'high' | 'medium' | 'low';

/** Live values the ink hulls read (shared by every hull material; set each frame by the pass that draws them). */
const HULL = {
  /** xy: clip units per target px (2/w, 2/h); z: hull line width in target px */
  uInkPx: { value: new THREE.Vector3(0.002, 0.002, 0) },
  /** view distances where the hull lines start to thin and are gone */
  uInkFade: { value: new THREE.Vector2(20, 50) },
  /** the ink in the scene target's linear light, before exposure and tone mapping (see setHull) */
  uInkLin: { value: new THREE.Color(0.043, 0.024, 0.032) },
};

/** Set the hulls' line width and fade for the target about to be drawn (Ink.frame does this). */
function setHull(w: number, h: number, px: number, near: number, far: number, exposure: number) {
  HULL.uInkPx.value.set(2 / w, 2 / h, px);
  HULL.uInkFade.value.set(near, far);
  // near black, ACES is about 0.172 x - 0.0004 per channel: this lands on the ink colour after the tone curve
  const e = 1 / Math.max(0.05, exposure);
  const lin = (c: number) => ((c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4) + 0.00038) / 0.172;
  HULL.uInkLin.value.setRGB(lin((INK_HEX >> 16) & 255) * e, lin((INK_HEX >> 8) & 255) * e, lin(INK_HEX & 255) * e);
}

// ------------------------------------------------------------------ the edge pass

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const EDGE = /* glsl */ `
uniform sampler2D tDepth; uniform sampler2D tColor;
uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec2 uTexel;
uniform float uWide; uniform float uCrease;
uniform vec4 uFade;
varying vec2 vUv;
vec3 viewAt(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
// the ink class at uv: .25 full, .5 silhouette only, 1 none (additive glows over a surface add whole layers of 1)
float cls(vec2 uv) {
  float a = texture2D(tColor, uv).a;
  if (a > 1.02) { a = fract(a); if (a < 0.1) a = 1.0; }
  return a;
}
// how far p stands out in front of the line through its neighbours a and b (relative, in 1/z, which is linear across
// a plane on screen: 0 on any flat surface however steeply it recedes, about the relative depth step at a silhouette)
float lift(float z0, float za, float zb) { return 2.0 - z0 / za - z0 / zb; }
// the bend between the tangents a->p and p->b (0 straight .. 2 folded back)
float bend(vec3 a, vec3 p, vec3 b) {
  vec3 u = p - a, v = b - p;
  float lu = length(u), lv = length(v);
  if (lu < 1e-7 || lv < 1e-7) return 0.0;
  return 1.0 - dot(u / lu, v / lv);
}
// a slow value noise (the pen's pressure along a line, anchored in the world so it never crawls)
float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float pen(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  if (texture2D(tDepth, vUv).x >= 0.99999) { gl_FragColor = vec4(0.0); return; }
  float c0 = cls(vUv);
  float sil = 1.0 - smoothstep(0.62, 0.88, c0);
  if (sil <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float full = 1.0 - smoothstep(0.3, 0.44, c0);
  vec3 P = viewAt(vUv);
  float z0 = max(-P.z, 1e-4);
  float fade = (1.0 - smoothstep(uFade.x, uFade.y, z0)) * smoothstep(uFade.z, uFade.z * 2.0, z0);
  if (fade <= 0.0) { gl_FragColor = vec4(0.0); return; }
  // the step that counts: small for solid things, large for leaf cards (only their edge against what's well behind)
  float T = mix(0.16, 0.03, full);
  vec2 t = uTexel;
  vec3 L = viewAt(vUv - vec2(t.x, 0.0)), R = viewAt(vUv + vec2(t.x, 0.0));
  vec3 D = viewAt(vUv - vec2(0.0, t.y)), U = viewAt(vUv + vec2(0.0, t.y));
  float rx = lift(z0, -L.z, -R.z), ry = lift(z0, -D.z, -U.z);
  float r = max(rx, ry);
#if INK_TIER >= 2
  r = max(r, lift(z0, -viewAt(vUv - t).z, -viewAt(vUv + t).z));
  r = max(r, lift(z0, -viewAt(vUv + vec2(-t.x, t.y)).z, -viewAt(vUv + vec2(t.x, -t.y)).z));
#endif
  float e = smoothstep(T * 0.6, T * 1.25, r);
#if INK_TIER >= 1
  vec3 L2 = viewAt(vUv - vec2(2.0 * t.x, 0.0)), R2 = viewAt(vUv + vec2(2.0 * t.x, 0.0));
  vec3 D2 = viewAt(vUv - vec2(0.0, 2.0 * t.y)), U2 = viewAt(vUv + vec2(0.0, 2.0 * t.y));
  float rx2 = lift(z0, -L2.z, -R2.z), ry2 = lift(z0, -D2.z, -U2.z);
  // a hand-drawn line's weight: heavier on the shadow side (the outside towards the lower right, away from the key
  // light), on things near the eye, and with a slow swell and thinning of the pen along the line
  float press = 0.0;
  if (max(r, max(rx2, ry2)) > T * 0.6) {
    vec2 outward = vec2(L.z - R.z, D.z - U.z) / z0 + vec2(L2.z - R2.z, D2.z - U2.z) / (2.0 * z0);
    float side = dot(outward, vec2(0.7071, -0.7071)) / max(length(outward), 1e-5);
    press = pen((uCamWorld * vec4(P, 1.0)).xyz * 1.6) - 0.5;
    float nearK = 1.0 - smoothstep(uFade.y * 0.05, uFade.y * 0.22, z0);
    float w = clamp(uWide + 0.06 + 0.36 * side + 0.2 * nearK + 0.55 * press, 0.0, 1.0) * full;
    e = max(e * (0.8 + 0.2 * clamp(side + 0.5, 0.0, 1.0) + 0.15 * press), smoothstep(T * 0.6, T * 1.25, max(rx2, ry2)) * w);
  }
  // creases (over a 4 px span, so bevelled and rounded edges count too): only between solid neighbours (never at fluff,
  // glass, glows or grass), never across a depth step; a little thinner than the silhouettes
  if (uCrease > 0.0 && full > 0.0) {
    float nc = max(max(cls(vUv - vec2(t.x, 0.0)), cls(vUv + vec2(t.x, 0.0))), max(cls(vUv - vec2(0.0, t.y)), cls(vUv + vec2(0.0, t.y))));
    float solid = full * (1.0 - smoothstep(0.3, 0.44, nc));
    float k = 0.0;
    if (abs(rx) < T && abs(rx2) < T * 2.0) k = max(k, bend(L2, P, R2));
    if (abs(ry) < T && abs(ry2) < T * 2.0) k = max(k, bend(D2, P, U2));
    e = max(e, smoothstep(0.18, 0.42, k) * (0.5 + 0.2 * press) * uCrease * solid);
  }
#endif
  // leaf cards: a finer line (their ragged edges would read as specks with a heavy one)
  gl_FragColor = vec4(e * sil * fade * mix(0.72, 1.0, full), 0.0, 0.0, 1.0);
}`;

/**
 * For a composite shader: `float inkCover(vec2 uv)` (0..1 how much ink covers this pixel) and INK_SRGB (the colour).
 * Uniforms: tInk, uInkTexel (one texel of the ink mask), uInkStr (inkUniforms()).
 */
export const INK_GLSL = /* glsl */ `
uniform sampler2D tInk; uniform vec2 uInkTexel; uniform float uInkStr;
const vec3 INK_SRGB = vec3(${((INK_HEX >> 16) & 255) / 255}, ${((INK_HEX >> 8) & 255) / 255}, ${(INK_HEX & 255) / 255});
float inkCover(vec2 uv) {
  vec2 o = uInkTexel * 0.5;
  float f = texture2D(tInk, uv - o).r + texture2D(tInk, uv + o).r + texture2D(tInk, uv + vec2(o.x, -o.y)).r + texture2D(tInk, uv + vec2(-o.x, o.y)).r;
  return smoothstep(0.1, 0.45, f * 0.25) * uInkStr;
}
// lay the ink over a display colour: warm near-black, with a breath of the colour it is drawn over (like a painter's
// line, which takes a little of the local colour rather than a flat mechanical black)
vec3 inkOver(vec3 col, float a) { return mix(col, mix(INK_SRGB, col * vec3(0.34, 0.3, 0.3), 0.2), a); }
`;
export const inkUniforms = () => ({ tInk: { value: null as THREE.Texture | null }, uInkTexel: { value: new THREE.Vector2(1, 1) }, uInkStr: { value: 0 } });

const DEFAULT: InkLook = { strength: 1, width: 1, crease: 1, far: 60 };
export const defaultInk = (): InkLook => ({ ...DEFAULT });

export class Ink {
  /** the edge mask (R8, the scene target's size) */
  readonly rt: THREE.WebGLRenderTarget;
  private mat: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private tier: InkTier = 'high';

  constructor(private gl: THREE.WebGLRenderer, tier: InkTier = 'high') {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { format: THREE.RedFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.rt.texture.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: EDGE, depthTest: false, depthWrite: false,
      uniforms: {
        tDepth: { value: null }, tColor: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() },
        uWide: { value: 0 }, uCrease: { value: 1 }, uFade: { value: new THREE.Vector4(30, 60, 0.1, 0) },
      },
    });
    this.setTier(tier);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const q = new THREE.Mesh(g, this.mat);
    q.frustumCulled = false;
    this.scene.add(q);
  }

  setTier(t: InkTier) {
    this.tier = t;
    const n = t === 'high' ? '2' : t === 'medium' ? '1' : '0';
    if (this.mat.defines.INK_TIER !== n) { this.mat.defines.INK_TIER = n; this.mat.needsUpdate = true; }
  }

  setSize(w: number, h: number) {
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
  }

  /** Target px of silhouette line for this look, given device px per target px and the device pixel ratio. */
  static widthPx(look: InkLook, pixel: number, ratio: number): number {
    return ((1.7 + 0.6 * Math.max(0, Math.min(1, ratio - 1))) * look.width) / pixel;
  }

  /**
   * Before the scene draws into a w x h target: the owls' hulls take their width and fade from this look.
   * `pixel` = device px per target px, `ratio` = the device pixel ratio.
   */
  frame(w: number, h: number, look: InkLook, pixel: number, ratio: number, exposure = 1) {
    const px = look.strength > 0.001 && inkDev.mode !== 'off' ? Ink.widthPx(look, pixel, ratio) * Math.min(1, look.strength) : 0;
    setHull(w, h, px, look.far * 0.4, look.far, exposure);
  }

  /** After the scene has drawn: hulls collapse again for any other renderer (portraits, bakes, window views). */
  static idle() { HULL.uInkPx.value.z = 0; }

  /** Mark the edges of what was just drawn into `src` (its colour's alpha holds the ink class; it needs a depth texture). */
  run(src: THREE.WebGLRenderTarget, camera: THREE.Camera, look: InkLook, pixel: number, ratio: number) {
    const u = this.mat.uniforms;
    this.setSize(src.width, src.height);
    u.tDepth.value = src.depthTexture;
    u.tColor.value = src.texture;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uTexel.value.set(1 / src.width, 1 / src.height);
    const w = Ink.widthPx(look, pixel, ratio);
    u.uWide.value = this.tier === 'low' ? 0 : THREE.MathUtils.clamp(w - 1.7, 0, 1);
    u.uCrease.value = this.tier === 'low' ? 0 : look.crease;
    const near = (camera as THREE.PerspectiveCamera).near ?? 0.1;
    u.uFade.value.set(look.far * 0.4, Math.max(look.far, 1e-3), near * 1.5, 0);
    const prev = this.gl.getRenderTarget();
    this.gl.setRenderTarget(this.rt);
    this.gl.render(this.scene, this.cam);
    this.gl.setRenderTarget(prev);
  }

  dispose() { this.rt.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------ owl hulls

const HULL_VS = /* glsl */ `
uniform float uLen; uniform vec3 uComb; uniform vec3 uWind; uniform sampler2D uMask; uniform float uHasMask;
uniform vec3 uInkPx; uniform vec2 uInkFade;
varying vec3 vN; varying vec3 vV; varying float vW;
void main() {
  // the line's width in px, thinning out with the part's distance (one value for the whole part); none at all outside
  // an inked pass (portraits, icon bakes, the world seen through a stage's window)
  float w = uInkPx.z * (1.0 - smoothstep(uInkFade.x, uInkFade.y, -modelViewMatrix[3].z));
  vW = w;
  if (w < 0.05) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec3 n = normalize(normal);
  // out to where the fluff thins (the mask is the fluff's length: none round the eyes and the bill), combed and swayed
  // as the shells are
  float len = uLen * (uHasMask > 0.5 ? texture2D(uMask, uv).r : 1.0);
  vec3 comb = uComb - n * dot(uComb, n);
  vec3 p = position + n * (len * 0.85) + comb * (len * 0.72) + uWind * 0.72;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 c = projectionMatrix * mv;
  // then a constant number of pixels outwards on screen
  vec3 vn = normalize(normalMatrix * n);
  vec2 dn = ((projectionMatrix * vec4(vn, 0.0)).xy + (c.xy / c.w) * vn.z) / uInkPx.xy;
  float l = length(dn);
  // heavier on the shadow side, like the screen-space lines
  if (l > 1e-6) { w *= 0.9 + 0.28 * dot(dn / l, vec2(0.7071, -0.7071)); c.xy += (dn / l) * uInkPx.xy * w * c.w; }
  vN = vn; vV = -mv.xyz; vW = w;
  gl_Position = c;
}`;
// only the outer band of the hull's back faces is drawn: near its contour n.v ~ -sqrt(2d/R), so the distance to the
// contour in px is about |n.v| / (2 |grad n.v|) (exact on round forms); the band's inner edge is anti-aliased
const HULL_FS = /* glsl */ `
uniform vec3 uInkLin;
varying vec3 vN; varying vec3 vV; varying float vW;
void main() {
  float ndv = dot(normalize(vN), normalize(vV));
  float g = length(vec2(dFdx(ndv), dFdy(ndv)));
  float d = abs(ndv) / max(2.0 * g, 1e-5);
  float a = 1.0 - smoothstep(vW - 0.5, vW + 0.5, d);
  if (a <= 0.003) discard;
  gl_FragColor = vec4(uInkLin, a);
}`;

export interface FurLike { uLen: { value: number }; uComb: { value: THREE.Vector3 }; uWind: { value: THREE.Vector3 }; uMask: { value: THREE.Texture | null } }

/**
 * An inverted ink hull for one furry part (sharing its geometry; add it beside the part, same transform). It outlines
 * the part's silhouette at the fluff's outer edge (translucent: drawn after the opaque things, behind the near
 * strands); the fluff shells themselves draw no ink (inkMaterial(shells, 'none')).
 */
export function inkHull(mesh: THREE.Mesh, fur: FurLike): THREE.Mesh {
  const mask = fur.uMask.value ?? ((mesh.material as THREE.MeshStandardMaterial).roughnessMap ?? null);
  const mat = new THREE.ShaderMaterial({
    vertexShader: HULL_VS, fragmentShader: HULL_FS, side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { uLen: fur.uLen, uComb: fur.uComb, uWind: fur.uWind, uMask: { value: mask }, uHasMask: { value: mask ? 1 : 0 }, ...HULL },
  });
  mat.name = 'ink-hull';
  const h = new THREE.Mesh(mesh.geometry, mat);
  h.name = mesh.name + ':ink';
  h.frustumCulled = false;
  h.castShadow = false;
  h.receiveShadow = false;
  return h;
}
