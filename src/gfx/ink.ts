// [outline9] Ink: crisp near-black outlines on everything the 3D views draw. [look12] Bold and steady: a solid #0e080b,
// about 2-2.5 device px round silhouettes and 1-1.5 px on creases at every screen density, lines between objects even
// where one lies flat on another (a rug on the floor, a book on a table), no shimmer on thin far things.
//
// One screen-space pass per frame (post.ts for the world and every stage, onboard/look.ts for the office), no extra
// geometry pass:
//   1. every opaque built-in material writes an ink class into the (otherwise unused) alpha of the HDR scene target,
//      through one patch of three's `opaque_fragment` chunk (installed when this module loads):
//        full (.25-.37) silhouettes, depth steps, creases and object edges: furniture, the oak, props, characters,
//                   terrain, rocks. [look12] The fraction above .25 is an object id (a hash of where the object, or the
//                   instance, is; written by the lit materials' vertex shaders), so two things touching can be told
//                   apart.
//        sil  (.5)  only an outer silhouette against something well behind it: leaf cards and other alpha-cut,
//                   double-sided cards (so a crown's inside never turns to scribble)
//        none (1)   nothing: unlit materials (window views, bulbs, glows), every ShaderMaterial (sky, grass, water,
//                   litter, far ridges, particles), the cleared background, and (in proportion) anything translucent
//                   blended over them (glass, smoke)
//      Additive glows add 1 to the alpha per layer (they write alpha 1), so a class is read from the fraction above 1:
//      a light shaft over a wall keeps the wall's lines. A material can override its class with inkMaterial().
//   2. the edge pass (Ink.run, at the scene target's size) reads the depth and the class and marks a one-pixel core:
//        R  the near side of every depth step (a 3-point second difference of 1/z, so receding floors and walls never
//           trigger), and [look12] of every small step towards the eye where the object changes (a rug's edge)
//        G  creases: the bend between view-space tangents where all four neighbours are solid, thinned to one pixel
//           (only the pixel where the bend peaks)
//        B  the local line weight, like a drawn line's: heavier on the shadow side (the outside towards the lower right,
//           away from the key light), on near things and with a slow pen pressure anchored in the world (so nothing
//           crawls); lighter far away and on leaf cards
//      Lines fade out with distance; thin things (a twig, a wire, a far branch a few pixels wide) lose theirs sooner,
//      before they could shimmer as they cross pixels.
//   3. the composite (inkCover) grows that core to the line's width (13 taps, anti-aliased by distance) and lays it over
//      the graded picture in the ink colour, faded where the depth of field blurs and under bright bloom (lamps glow
//      over their lines).
// The owls' fluff would give a noisy, crawling contour, so a furry part draws no screen-space ink at all (fur.ts) and
// gets an inverted hull instead (inkHull): its back faces pushed out to the fluff's outer edge and then a constant
// number of pixels on screen, drawing only that last band (one clean silhouette line that the longest strands cross
// over, [look12] and no second contour along the bare part's edge inside the fluff).
// Cost tiers: high (8 depth taps, creases, object edges), medium (4, creases, object edges), low (4 taps, outlines only).
import * as THREE from 'three';

/** Dev: `?ink=0` in the URL draws no outlines (A/B), `?ink=mask` shows the edge mask (post.ts); live-editable. */
export const inkDev: { mode: '' | 'off' | 'mask' } = {
  mode: typeof location === 'undefined' ? '' : /[?&]ink=0\b/.test(location.search) ? 'off' : /[?&]ink=mask\b/.test(location.search) ? 'mask' : '',
};

/** The ink colour (display sRGB). [look12] a solid near-black (was the warmer, lighter #140c10) */
export const INK_HEX = 0x0e080b;
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
{
  float hhInk = HH_INK;
#ifdef HH_INKID
  if ( hhInk < 0.3 ) hhInk += 0.12 * vHhInkId;
#endif
  gl_FragColor.a = hhInk;
}
#endif
`;
// [look12] the object id, flat across an object: a hash of where it (or the instance) is
const ID_VERT = /* glsl */ `
#ifdef HH_INKID
{
  vec3 hhO = modelMatrix[ 3 ].xyz;
#ifdef USE_INSTANCING
  hhO += mat3( modelMatrix ) * instanceMatrix[ 3 ].xyz;
#endif
#ifdef USE_BATCHING
  hhO += mat3( modelMatrix ) * batchingMatrix[ 3 ].xyz;
#endif
  vHhInkId = fract( sin( dot( floor( hhO * 24.0 ), vec3( 12.9898, 78.233, 45.164 ) ) ) * 43758.5453 );
}
#endif
`;
const ID_LIBS = ['lambert', 'phong', 'standard', 'physical', 'toon', 'matcap'] as const;
const ID_HEAD = '#define HH_INKID\nvarying float vHhInkId;\n';
const UNLIT = ['basic', 'points', 'sprite'] as const;
let installed = false;
/** Patch three's shaders so opaque materials write their ink class and object id (idempotent; runs on import). */
export function installInk(): void {
  if (installed) return;
  installed = true;
  const SC = THREE.ShaderChunk as unknown as Record<string, string> & { __hhInkOrig?: string; __hhInkVOrig?: string };
  const orig = (SC.__hhInkOrig ??= SC.opaque_fragment);
  SC.opaque_fragment = orig + OPAQUE_INK;
  const origV = (SC.__hhInkVOrig ??= SC.project_vertex);
  SC.project_vertex = origV + ID_VERT;
  for (const id of UNLIT) {
    const lib = THREE.ShaderLib[id];
    if (lib && !lib.fragmentShader.startsWith('#define HH_UNLIT')) lib.fragmentShader = '#define HH_UNLIT\n' + lib.fragmentShader;
  }
  for (const id of ID_LIBS) {
    const lib = THREE.ShaderLib[id];
    if (!lib) continue;
    if (!lib.vertexShader.startsWith('#define HH_INKID')) lib.vertexShader = ID_HEAD + lib.vertexShader;
    if (!lib.fragmentShader.startsWith('#define HH_INKID')) lib.fragmentShader = ID_HEAD + lib.fragmentShader;
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
  /** line weight multiplier (1 = about 2 device px round silhouettes on a 1x screen, 2.4 on a 2x one) */
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

/** [look12] The composite's line half-widths in target px (x: outlines, y: creases), shared by every composite that
 * includes INK_GLSL; Ink.run sets it right before that composite draws. */
const INK_W = { value: new THREE.Vector2(1, 0.6) };

// ------------------------------------------------------------------ the edge pass

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const EDGE = /* glsl */ `
uniform sampler2D tDepth; uniform sampler2D tColor;
uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec2 uTexel;
uniform float uCrease;
uniform vec4 uFade;
varying vec2 vUv;
vec3 viewAt(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
// the ink class at uv: .25-.37 full (the fraction is the object id), .5 silhouette only, 1 none (additive glows over a
// surface add whole layers of 1)
float cls(vec2 uv) {
  float a = texture2D(tColor, uv).a;
  if (a > 1.02) { a = fract(a); if (a < 0.1) a = 1.0; }
  return a;
}
float fullOf(float a) { return 1.0 - smoothstep(0.4, 0.46, a); }
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
// a small step towards the eye where the object changes (a rug on the floor, a book on a table, a plate on a shelf);
// never on a flat surface (a decal, a shadow blob or smoke over it changes the alpha but not the depth)
float objStep(float r, float a0, float aa, float ab) {
  float d = max(abs(a0 - aa) * fullOf(aa), abs(a0 - ab) * fullOf(ab));
  return smoothstep(0.0004, 0.0016, r) * smoothstep(0.0012, 0.0028, d);
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
  float full = fullOf(c0);
  vec3 P = viewAt(vUv);
  float z0 = max(-P.z, 1e-4);
  float fade = (1.0 - smoothstep(uFade.x, uFade.y, z0)) * smoothstep(uFade.z, uFade.z * 2.0, z0);
  if (fade <= 0.0) { gl_FragColor = vec4(0.0); return; }
  // the step that counts: small for solid things, large for leaf cards (only their edge against what's well behind)
  float T = mix(0.16, 0.03, full);
  vec2 t = uTexel;
  vec2 uL = vUv - vec2(t.x, 0.0), uR = vUv + vec2(t.x, 0.0), uD = vUv - vec2(0.0, t.y), uU = vUv + vec2(0.0, t.y);
  vec3 L = viewAt(uL), R = viewAt(uR), D = viewAt(uD), U = viewAt(uU);
  float zL = -L.z, zR = -R.z, zD = -D.z, zU = -U.z;
  float rx = lift(z0, zL, zR), ry = lift(z0, zD, zU);
  float r = max(rx, ry);
#if INK_TIER >= 2
  r = max(r, lift(z0, -viewAt(vUv - t).z, -viewAt(vUv + t).z));
  r = max(r, lift(z0, -viewAt(vUv + vec2(-t.x, t.y)).z, -viewAt(vUv + vec2(t.x, -t.y)).z));
#endif
  float e = smoothstep(T * 0.6, T * 1.25, r);
  // thin things (both neighbours on an axis well behind) shimmer as they cross pixels: their line goes sooner
  float thin = max(step(T, 1.0 - z0 / zL) * step(T, 1.0 - z0 / zR), step(T, 1.0 - z0 / zD) * step(T, 1.0 - z0 / zU));
  float cr = 0.0;
#if INK_TIER >= 1
  vec3 L2 = viewAt(vUv - vec2(2.0 * t.x, 0.0)), R2 = viewAt(vUv + vec2(2.0 * t.x, 0.0));
  vec3 D2 = viewAt(vUv - vec2(0.0, 2.0 * t.y)), U2 = viewAt(vUv + vec2(0.0, 2.0 * t.y));
  // two or three pixels wide counts as thin too
  thin = max(thin, max(step(T, 1.0 - z0 / -L2.z) * step(T, 1.0 - z0 / -R2.z), step(T, 1.0 - z0 / -D2.z) * step(T, 1.0 - z0 / -U2.z)) * 0.7);
  float aL = cls(uL), aR = cls(uR), aD = cls(uD), aU = cls(uU);
  // where one object lies flat on another just behind it (only solid things, both sides; only on surfaces facing up,
  // so the seam between two parts of a wall or a trunk never draws)
  if (full > 0.5) {
    vec3 nW = mat3(uCamWorld) * normalize(cross(R - L, U - D));
    float up = smoothstep(0.6, 0.85, abs(nW.y));
    if (up > 0.0) e = max(e, max(objStep(rx, c0, aL, aR), objStep(ry, c0, aD, aU)) * full * up);
  }
  // creases (only between solid neighbours, never at fluff, glass, glows or grass, never across a depth step), one
  // pixel wide: kept only where the bend peaks along the axis
  if (uCrease > 0.0 && full > 0.0) {
    float solid = full * (1.0 - smoothstep(0.4, 0.46, max(max(aL, aR), max(aD, aU))));
    float k = 0.0;
    if (abs(rx) < T && abs(lift(z0, -L2.z, -R2.z)) < T * 2.0) {
      float b0 = bend(L, P, R);
      if (b0 > bend(L2, L, P) && b0 >= bend(P, R, R2)) k = max(k, b0);
    }
    if (abs(ry) < T && abs(lift(z0, -D2.z, -U2.z)) < T * 2.0) {
      float b0 = bend(D, P, U);
      if (b0 > bend(D2, D, P) && b0 >= bend(P, U, U2)) k = max(k, b0);
    }
    cr = smoothstep(0.1, 0.26, k) * uCrease * solid * (1.0 - smoothstep(uFade.x * 0.5, uFade.x * 1.3, z0));
  }
#endif
  e *= 1.0 - thin * smoothstep(uFade.x * 0.25, uFade.x * 0.8, z0);
  // the line's weight here
  float b = 0.0;
  if (max(e, cr) > 0.003) {
    vec2 outward = vec2(zR - zL, zU - zD);
    float side = dot(outward, vec2(0.7071, -0.7071)) / max(length(outward), 1e-5);
    float press = pen((uCamWorld * vec4(P, 1.0)).xyz * 1.6) - 0.5;
    float nearK = 1.0 - smoothstep(uFade.y * 0.05, uFade.y * 0.22, z0);
    float farK = smoothstep(uFade.x * 0.5, uFade.y, z0);
    b = clamp(0.62 + 0.16 * side * step(0.01, e) + 0.12 * nearK + 0.3 * press - 0.45 * farK - 0.22 * (1.0 - full), 0.0, 1.0);
  }
  // leaf cards: a lighter line (their ragged edges would read as scribble under a heavy one)
  gl_FragColor = vec4(e * sil * fade * mix(0.66, 1.0, full), cr * fade, b, 1.0);
}`;

/**
 * For a composite shader: `float inkCover(vec2 uv)` (0..1 how much ink covers this pixel), `vec3 inkOver(col, a)` and
 * INK_SRGB (the colour). Uniforms: tInk, uInkTexel (one texel of the ink mask), uInkStr, uInkW (inkUniforms()).
 */
export const INK_GLSL = /* glsl */ `
uniform sampler2D tInk; uniform vec2 uInkTexel; uniform float uInkStr; uniform vec2 uInkW;
const vec3 INK_SRGB = vec3(${((INK_HEX >> 16) & 255) / 255}, ${((INK_HEX >> 8) & 255) / 255}, ${(INK_HEX & 255) / 255});
// one core pixel of the mask at offset o (d = |o|): its outline and crease grown to their half-widths (scaled by the
// pen's weight there), anti-aliased by distance
float inkTap(vec2 uv, vec2 o, float d) {
  vec4 m = texture2D(tInk, uv + o * uInkTexel);
  float k = 0.45 + 0.9 * m.b;
  return max(m.r * clamp(uInkW.x * k + 0.5 - d, 0.0, 1.0), m.g * clamp(uInkW.y * k + 0.5 - d, 0.0, 1.0));
}
float inkCover(vec2 uv) {
  float c = inkTap(uv, vec2(0.0), 0.0);
  c = max(c, max(max(inkTap(uv, vec2(1.0, 0.0), 1.0), inkTap(uv, vec2(-1.0, 0.0), 1.0)), max(inkTap(uv, vec2(0.0, 1.0), 1.0), inkTap(uv, vec2(0.0, -1.0), 1.0))));
  c = max(c, max(max(inkTap(uv, vec2(1.0, 1.0), 1.4142), inkTap(uv, vec2(-1.0, 1.0), 1.4142)), max(inkTap(uv, vec2(1.0, -1.0), 1.4142), inkTap(uv, vec2(-1.0, -1.0), 1.4142))));
  c = max(c, max(max(inkTap(uv, vec2(2.0, 0.0), 2.0), inkTap(uv, vec2(-2.0, 0.0), 2.0)), max(inkTap(uv, vec2(0.0, 2.0), 2.0), inkTap(uv, vec2(0.0, -2.0), 2.0))));
  return c * uInkStr;
}
// lay the ink over a display colour: a solid near-black (just a breath of the colour under it, so it never reads as a
// hole in the picture)
vec3 inkOver(vec3 col, float a) { return mix(col, mix(INK_SRGB, col * 0.3, 0.07), a); }
`;
export const inkUniforms = () => ({ tInk: { value: null as THREE.Texture | null }, uInkTexel: { value: new THREE.Vector2(1, 1) }, uInkStr: { value: 0 }, uInkW: INK_W });

const DEFAULT: InkLook = { strength: 1, width: 1, crease: 1, far: 60 };
export const defaultInk = (): InkLook => ({ ...DEFAULT });

export class Ink {
  /** the edge mask (RGBA8, the scene target's size): outline core, crease core, line weight */
  readonly rt: THREE.WebGLRenderTarget;
  private mat: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private tier: InkTier = 'high';

  constructor(private gl: THREE.WebGLRenderer, tier: InkTier = 'high') {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.rt.texture.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: EDGE, depthTest: false, depthWrite: false,
      uniforms: {
        tDepth: { value: null }, tColor: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() },
        uCrease: { value: 1 }, uFade: { value: new THREE.Vector4(30, 60, 0.1, 0) },
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

  /** Target px of outline for this look, given device px per target px and the device pixel ratio: [look12] about 2
   * device px on a 1x screen, 2.4 on a 2x one. */
  static widthPx(look: InkLook, pixel: number, ratio: number): number {
    return ((2.0 + 0.4 * Math.max(0, Math.min(1, ratio - 1))) * look.width) / pixel;
  }

  /** [look12] Target px of crease line: about 1.15 device px on a 1x screen, 1.45 on a 2x one. */
  static creasePx(look: InkLook, pixel: number, ratio: number): number {
    return ((1.15 + 0.3 * Math.max(0, Math.min(1, ratio - 1))) * look.width) / pixel;
  }

  /**
   * Before the scene draws into a w x h target: the owls' hulls take their width and fade from this look.
   * `pixel` = device px per target px, `ratio` = the device pixel ratio.
   */
  frame(w: number, h: number, look: InkLook, pixel: number, ratio: number, exposure = 1) {
    const px = look.strength > 0.001 && inkDev.mode !== 'off' ? Ink.widthPx(look, pixel, ratio) * 0.9 * Math.min(1, look.strength) : 0;
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
    u.uCrease.value = this.tier === 'low' ? 0 : look.crease;
    const near = (camera as THREE.PerspectiveCamera).near ?? 0.1;
    u.uFade.value.set(look.far * 0.4, Math.max(look.far, 1e-3), near * 1.5, 0);
    // the composite that follows grows the core to these half-widths
    INK_W.value.set(Ink.widthPx(look, pixel, ratio) / 2, Ink.creasePx(look, pixel, ratio) / 2);
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
  // [look12] at the depth of the bare part's rim brought half the fluff's length towards the eye, not of the fluff's
  // outer edge: in front of most strands, but a wing lying in the fluff hides the line behind it (it was drawn over the
  // wing, a second contour beside the wing's own)
  vec4 mv0 = modelViewMatrix * vec4(position, 1.0);
  float lenV = length((modelViewMatrix * vec4(n * len, 0.0)).xyz);
  vec4 rim = projectionMatrix * vec4(mv0.xyz + normalize(-mv0.xyz) * lenV * 0.5, 1.0);
  c.z = (rim.z / rim.w) * c.w;
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
