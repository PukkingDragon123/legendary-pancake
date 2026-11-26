// [light7] "Painted light": a realistic cel-shaded lighting model for every lit material in the game.
//
// One global patch of three's light chunks (installed when this module loads, before anything compiles) turns the
// direct light on MeshStandardMaterial, MeshPhysicalMaterial and MeshLambertMaterial into three soft-edged bands,
// while the hand-painted textures stay fully visible (only the light is banded, never the albedo):
//   - lit: the full key light (warm sun, lamp gold, moon blue),
//   - a half-tone at the terminator (half the light, a touch warmer and richer, like a painter's turning edge),
//   - shadow: no direct light, but a cool violet-blue bounce in proportion to the key light's strength, so shadows
//     carry colour instead of falling to grey or black mud.
// Cast shadows from the sun / moon go through the same ramp (they are kept apart from the light's colour), so form
// shadows and cast shadows share one crisp-but-slightly-soft edge and one hue. A little of the real gradient is kept
// inside each band (`bands` < 1) so round things still read round.
// Smooth materials (brass, glass, ceramics, the bill of an owl) get crisp, small specular glints: the GGX lobe is cut
// to a bright core with a soft rim instead of a broad sheen. Rough paint, wood and cloth keep their matte response.
// Opt-in per material: a gentle rim light on silhouettes (Pip, furniture, the oak) that is strongest when the light
// comes from behind, plus the sky wrapping round the edge on the shadow side.
//
// Everything is on by default for those three material types (there is nothing to call). Per-material knobs are
// compile-time defines set with applyCelShading(material, opts); celScene(root, opts) does a whole subtree.
// celLights(scene) adds the reference light rig (warm key from the upper left, cool sky fill) to a scene that has
// none of its own, e.g. the HUD shelf or the cuckoo-clock stage. Dev: `?cel=0` in the URL skips the patch (A/B).
//
// The reference look for 2D art that has to sit next to it is CEL_REF below.
import * as THREE from 'three';

export interface CelOpts {
  /** plain physically based light for this material (no bands, no glints, no rim) */
  off?: boolean;
  /** 0..1 how stylised the light is: 1 = flat bands, 0 = the real gradient (default 0.8) */
  bands?: number;
  /** rim light on silhouettes (0 = none, the default; ~0.3 props, ~0.5 characters) */
  rim?: number;
  /** 0..1 crispness of the specular glints on smooth materials (default 1) */
  glint?: number;
  /** 0..2 strength of the cool coloured fill in the key light's shadow (default 1) */
  shade?: number;
}

/**
 * The reference look in words and numbers, for painted 2D art (HUD objects, icons, emotes) that has to sit next to the
 * 3D: realistic, high-resolution materials under one warm key light from the upper left, with the light falling off in
 * three softened steps, cool violet-blue shadows that keep the local colour rich, a thin rim of light on silhouettes,
 * small crisp highlights on hard materials, and [outline9] a warm near-black ink line round every form (see `outline`).
 */
export const CEL_REF = {
  /** key light direction in screen terms: from the upper left, slightly in front of the subject; warm (#ffe2bc) */
  light: 'upper-left, ~45 deg up, ~30 deg towards the viewer; warm white #ffe2bc',
  /** light steps on a surface (fraction of the key): lit 100%, a half-tone ~50% at the turning edge, shadow 0% + fill */
  bands: [1, 0.5, 0] as const,
  /** the transition between steps: soft over ~2-4% of a form's width (crisp but not aliased) */
  edge: 'soft over a few percent of the form',
  /** the half-tone's warm shift (multiply the lit colour) */
  halftone: '#ffeee0',
  /** the shadow side: the local colour darkened to ~30-40% and pushed towards violet-blue, saturation kept (never grey) */
  shadowHue: '#5a4fa0',
  /** rim: a thin edge (~1.5% of the silhouette's size) of cool sky light on the shadow side, warm key light when back-lit */
  rim: 'thin edge, cool sky colour on the shadow side, warm key colour when back-lit, ~30-50% of the key',
  /** specular: a small, hard-edged glint on brass, glass, ceramics, lacquer and eyes; none on cloth, paper, matte wood */
  glint: 'small and hard-edged, only on smooth materials',
  /** [outline9] the 3D's ink (src/gfx/ink.ts): warm near-black #140c10 with a breath of the local colour; ~1.7 px on
   * 1x screens, 2.3 on 2x round silhouettes and depth steps, thinner on inner creases; heavier on the shadow side
   * (lower right, away from the key light), finer on the lit side and on leaves; thinning out with distance */
  outline: 'warm near-black #140c10, ~1.7-2.3 px silhouettes, thinner creases, heavier on the shadow side',
} as const;

const FNS = /* glsl */ `
#ifndef HH_NOCEL
#define HH_CEL
#endif
#ifdef HH_CEL
#ifndef HH_CEL_BANDS
#define HH_CEL_BANDS 0.8
#endif
#ifndef HH_CEL_GLINT
#define HH_CEL_GLINT 1.0
#endif
#ifndef HH_CEL_SHADE
#define HH_CEL_SHADE 1.0
#endif
// live knobs of the scene being drawn (see celKnobs): x shadow fill, y rim, z lamp bands, w key bands (all 0 = plain)
uniform vec4 hhCel;
// rgb: the hue of the key light's shadow fill; w: how much shadow-casting spot lights count as a key (a sun shaft)
uniform vec4 hhCelTint;
// [look12] the painted colour itself (see celKnobs): x vibrance (the duller a colour, the more its own hue grows),
// y saturation, z how much of the extra goes to warm orange-browns (1 = as much as any hue, less keeps wood from
// turning orange), w unused
uniform vec4 hhAlbedo;
vec3 celAlbedo( vec3 c ) {
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  float mx = max( c.r, max( c.g, c.b ) ), mn = min( c.r, min( c.g, c.b ) );
  float s = ( mx - mn ) / max( mx, 1e-4 );
  // orange-brown: red highest, then green, blue lowest, green about half way (wood, floorboards, leather, clay)
  float hueO = step( c.g, c.r ) * step( c.b, c.g ) * ( 1.0 - abs( ( c.g - c.b ) / max( c.r - c.b, 1e-4 ) - 0.42 ) * 2.4 );
  float k = ( hhAlbedo.y * ( 1.0 + hhAlbedo.x * ( 1.0 - s ) * smoothstep( 0.002, 0.03, l ) ) - 1.0 ) * mix( 1.0, hhAlbedo.z, saturate( hueO ) );
  return max( mix( vec3( l ), c, 1.0 + k ), 0.0 );
}
// the key light's cast shadow (sun / moon), kept apart from its colour; 1 while point and spot lights are added
float celShadow = 1.0;
// 1 while the directional (key) lights are added, 0 for lamps
float celKey = 0.0;
// the key lights' coloured shadow fill, gathered with the direct light and handed to the ambient
vec3 celFill = vec3( 0.0 );
// three soft-edged steps of light: shadow (0), the terminator's half-tone (0.5), lit (1)
float celMid( float x ) { return smoothstep( 0.015, 0.075, x ); }
float celLit( float x ) { return smoothstep( 0.26, 0.36, x ); }
vec3 celIrradiance( const in vec3 n, const in IncidentLight l ) {
  float x = saturate( dot( n, l.direction ) ) * celShadow;
  float mid = celMid( x ), lit = celLit( x );
  float k = HH_CEL_BANDS * mix( hhCel.z, hhCel.w, celKey );
  float a = mix( x, mid * mix( 0.5, 1.0, lit ), k );
  // the half-tone runs a touch warmer and richer, like paint turning the edge of a form
  vec3 c = l.color * a * mix( vec3( 1.0 ), vec3( 1.07, 0.98, 0.9 ), mid * ( 1.0 - lit ) * k );
  // coloured shadow: where the key light can't reach, a cool violet bounce in proportion to its strength (it joins
  // the ambient light, see lights_fragment_end)
  float lum = min( dot( l.color, vec3( 0.2126, 0.7152, 0.0722 ) ), 3.5 );
  celFill += hhCelTint.rgb * ( lum * celKey * ( 1.0 - a ) * hhCel.x * HH_CEL_SHADE );
  return c;
}
// crisp, small specular glints on smooth materials: the GGX lobe cut to its bright core with a soft edge
vec3 celGlint( const in vec3 spec, const in vec3 n, const in vec3 v, const in vec3 l, const in float rough ) {
  float a2 = pow2( pow2( rough ) );
  float nh = saturate( dot( n, normalize( l + v ) ) );
  float dn = pow2( a2 / ( nh * nh * ( a2 - 1.0 ) + 1.0 ) );
  float k = ( 1.0 - smoothstep( 0.42, 0.72, rough ) ) * HH_CEL_GLINT * step( 0.001, hhCel.w );
  return mix( spec, spec * smoothstep( 0.26, 0.4, dn ) * 1.4, k );
}
#ifdef HH_CEL_RIM
// a thin edge of the silhouette (crisp, soft by a pixel or two)
float celRimEdge( const in vec3 n, const in vec3 v ) { return smoothstep( 0.6, 0.76, 1.0 - saturate( dot( n, v ) ) ) * HH_CEL_RIM * hhCel.y; }
// the key light catching the silhouette: strongest when it comes from behind, never on the fully unlit side
vec3 celRim( const in vec3 n, const in vec3 v, const in IncidentLight l ) {
  float back = 0.4 + 0.6 * saturate( - dot( v, l.direction ) );
  return l.color * ( celShadow * celRimEdge( n, v ) * saturate( dot( n, l.direction ) + 0.45 ) * back );
}
#endif
#endif
`;

const P = (re: RegExp | string, to: string, src: string, what: string): string => {
  const out = src.replace(re, to);
  if (out === src) console.warn(`[cel] three's ${what} chunk changed; that part of the cel light is off`);
  return out;
};

export interface CelKnobs {
  /** strength of the cool fill in the key light's shadow (1 = default; lower indoors where little sky gets in) */
  fill: number;
  /** rim light multiplier (on top of each material's own rim) */
  rim: number;
  /** how banded lamp (point / spot) light is, 0..1 */
  lampBands: number;
  /** how banded the key (sun / moon) light is, 0..1 (0 = plain physically based) */
  keyBands: number;
  /** the shadow fill's hue (linear RGB) */
  tint: THREE.Color;
  /** 0..1 how much a shadow-casting spot light counts as a key light (a sun or moon shaft through a window) */
  spotKey: number;
  /** [look12] painted colour: vibrance (0 = off; the duller a colour, the more its own hue grows) */
  vibrance: number;
  /** [look12] painted colour: saturation (1 = as painted) */
  saturation: number;
  /** [look12] 0..1 how much of that extra colour orange-browns get (wood and floorboards stay wood, not orange) */
  orange: number;
}
const defaults = (): CelKnobs => ({ fill: 1, rim: 1, lampBands: 0.6, keyBands: 1, tint: new THREE.Color(0.3, 0.2, 0.48), spotKey: 0, vibrance: 0.3, saturation: 1.08, orange: 0.35 });
const DEFAULT = defaults();
const LIVE = { x: 1, y: 1, z: 0.6, w: 1 };
const TINT = { x: 0.3, y: 0.2, z: 0.48, w: 0 };
const ALBEDO = { x: 0.3, y: 1.08, z: 0.35, w: 0 }; // [look12]
function push(k: CelKnobs) {
  LIVE.x = k.fill * 0.4; LIVE.y = k.rim; LIVE.z = k.lampBands; LIVE.w = k.keyBands;
  TINT.x = k.tint.r; TINT.y = k.tint.g; TINT.z = k.tint.b; TINT.w = k.spotKey;
  ALBEDO.x = k.vibrance; ALBEDO.y = k.saturation; ALBEDO.z = k.orange;
}
push(DEFAULT);
const sceneKnobs = new WeakMap<THREE.Scene, CelKnobs>();
/**
 * The live cel knobs of one scene (created on first call): they apply while that scene renders and fall back to the
 * defaults after, so every scene (the world, a stage, the HUD shelf) keeps its own.
 */
export function celKnobs(scene: THREE.Scene): CelKnobs {
  let k = sceneKnobs.get(scene);
  if (k) return k;
  const kk = (k = defaults());
  sceneKnobs.set(scene, kk);
  const before = scene.onBeforeRender, after = scene.onAfterRender;
  scene.onBeforeRender = function (this: THREE.Scene, ...a: Parameters<THREE.Scene['onBeforeRender']>) { push(kk); before.apply(this, a); };
  scene.onAfterRender = function (this: THREE.Scene, ...a: Parameters<THREE.Scene['onAfterRender']>) { after.apply(this, a); push(DEFAULT); };
  return k;
}

const CHUNKS = ['lights_physical_pars_fragment', 'lights_lambert_pars_fragment', 'lights_fragment_begin', 'lights_fragment_end', 'color_fragment'] as const;
let installed = false;
/** Patch three's light chunks (idempotent; runs on import). */
export function installCel(): void {
  if (installed) return;
  installed = true;
  if (typeof location !== 'undefined' && /[?&]cel=0\b/.test(location.search)) return;
  // always patch three's own chunks (kept aside on first install), so a second copy of this module (hot reload) can't
  // stack a second patch on the first
  const SC = THREE.ShaderChunk as unknown as Record<string, string> & { __hhCelOrig?: Record<string, string> };
  const O = (SC.__hhCelOrig ??= {});
  for (const k of CHUNKS) O[k] ??= SC[k]; // [look12] (a chunk added later is kept aside too)
  const C: Record<string, string> = { ...O };
  // the live knobs reach every lit material: plain objects in the shader library's uniforms are shared by reference
  // when three clones them per material (Vector/Color values would be copied)
  for (const id of ['standard', 'physical', 'lambert']) Object.assign(THREE.ShaderLib[id].uniforms, { hhCel: { value: LIVE }, hhCelTint: { value: TINT }, hhAlbedo: { value: ALBEDO } });
  // the bands, the glints and the rim in the physically based direct light
  C.lights_physical_pars_fragment = FNS + P(
    /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/,
    `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	#ifdef HH_CEL
	vec3 irradiance = celIrradiance( geometryNormal, directLight );
	vec3 celSpecIn = directLight.color * ( dotNL * celShadow );
	#ifdef HH_CEL_RIM
	reflectedLight.directDiffuse += celRim( geometryNormal, geometryViewDir, directLight ) * BRDF_Lambert( material.diffuseColor );
	#endif
	#else
	vec3 irradiance = dotNL * directLight.color;
	#endif`,
    P('reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );',
      `#ifdef HH_CEL
	reflectedLight.directSpecular += celSpecIn * celGlint( BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material ), geometryNormal, geometryViewDir, directLight.direction, material.roughness );
	#else
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#endif`, C.lights_physical_pars_fragment, 'physical specular'),
    'physical diffuse');
  // the same bands on Lambert (terrain, far woods, the voxel kit)
  C.lights_lambert_pars_fragment = FNS + P(
    /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/,
    `#ifdef HH_CEL
	vec3 irradiance = celIrradiance( geometryNormal, directLight );
	#ifdef HH_CEL_RIM
	reflectedLight.directDiffuse += celRim( geometryNormal, geometryViewDir, directLight ) * BRDF_Lambert( material.diffuseColor );
	#endif
	#else
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#endif`, C.lights_lambert_pars_fragment, 'lambert diffuse');
  // keep the directional lights' cast shadow apart from their colour, and tell the ramp which lights are the key
  let b = C.lights_fragment_begin;
  b = P(/(\n[ \t]*)directLight\.color \*= (\( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap\[ i \][^\n]*: 1\.0;)/,
    '\n#ifdef HH_CEL$1celShadow = $2\n#else$1directLight.color *= $2\n#endif', b, 'directional shadow');
  b = P('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n#ifdef HH_CEL\n\t\tcelKey = 1.0; celShadow = 1.0;\n#endif', b, 'directional light');
  b = P('getPointLightInfo( pointLight, geometryPosition, directLight );', 'getPointLightInfo( pointLight, geometryPosition, directLight );\n#ifdef HH_CEL\n\t\tcelKey = 0.0; celShadow = 1.0;\n#endif', b, 'point light');
  b = P('getSpotLightInfo( spotLight, geometryPosition, directLight );', 'getSpotLightInfo( spotLight, geometryPosition, directLight );\n#ifdef HH_CEL\n\t\tcelKey = 0.0; celShadow = 1.0;\n#endif', b, 'spot light');
  // spot and point lights' cast shadows go through the ramp too (a shadow-casting spot may count as a key, see spotKey)
  b = P(/(\n[ \t]*)directLight\.color \*= (\( directLight\.visible && receiveShadow \) \? getShadow\( spotShadowMap\[ i \][^\n]*: 1\.0;)/,
    '\n#ifdef HH_CEL$1celShadow = $2$1celKey = hhCelTint.w;\n#else$1directLight.color *= $2\n#endif', b, 'spot shadow');
  b = P(/(\n[ \t]*)directLight\.color \*= (\( directLight\.visible && receiveShadow \) \? getPointShadow\( [^\n]*: 1\.0;)/,
    '\n#ifdef HH_CEL$1celShadow = $2\n#else$1directLight.color *= $2\n#endif', b, 'point shadow');
  C.lights_fragment_begin = b;
  // the shadow fill joins the ambient light; the rim's sky half wraps the ambient round the silhouette; and the light
  // in shadow keeps the colour of what it lights (a cool fill over warm paint must not cancel out to grey)
  // [look12] fuller painted colour on every lit material (after the map and the vertex / instance colours)
  C.color_fragment += `
#ifdef HH_CEL
	diffuseColor.rgb = celAlbedo( diffuseColor.rgb );
#endif
`;
  C.lights_fragment_end = `
#if defined( HH_CEL ) && defined( RE_IndirectDiffuse )
	irradiance += celFill;
	#ifdef HH_CEL_RIM
	{
		float celR = 1.0 + celRimEdge( geometryNormal, geometryViewDir ) * 1.3;
		irradiance *= celR;
		#if defined( RE_IndirectSpecular )
		iblIrradiance *= celR;
		#endif
	}
	#endif
#endif
` + C.lights_fragment_end + `
#if defined( HH_CEL ) && defined( RE_IndirectDiffuse )
	{
		vec3 celD = reflectedLight.indirectDiffuse;
		float celL = dot( celD, vec3( 0.2126, 0.7152, 0.0722 ) );
		reflectedLight.indirectDiffuse = max( mix( vec3( celL ), celD, 1.0 + 0.3 * HH_CEL_SHADE * step( 0.001, hhCel.w ) ), 0.0 );
	}
#endif
`;
  for (const k of CHUNKS) SC[k] = C[k];
}
installCel();

const f3 = (v: number) => v.toFixed(3);
type Lit = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshLambertMaterial;
const isLit = (m: THREE.Material | null | undefined): m is Lit =>
  !!m && ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial);

/**
 * Set a material's cel knobs (compile-time defines; the material recompiles once if anything changed). Materials are
 * cel-shaded by default, so this is only for the rim, a softer or flatter ramp, or opting out (`{ off: true }`).
 * Note: `material.clone()` of a MeshStandardMaterial resets its defines; call this again on the clone.
 */
export function applyCelShading<M extends THREE.Material>(material: M, opts: CelOpts = {}): M {
  if (!isLit(material)) return material;
  const d = (material.defines ??= {}) as Record<string, string>;
  const want: Record<string, string | undefined> = {
    HH_NOCEL: opts.off ? '' : undefined,
    HH_CEL_BANDS: opts.bands !== undefined && opts.bands !== 0.8 ? f3(THREE.MathUtils.clamp(opts.bands, 0, 1)) : undefined,
    HH_CEL_RIM: opts.rim && opts.rim > 0 ? f3(opts.rim) : undefined,
    HH_CEL_GLINT: opts.glint !== undefined && opts.glint !== 1 ? f3(THREE.MathUtils.clamp(opts.glint, 0, 1)) : undefined,
    HH_CEL_SHADE: opts.shade !== undefined && opts.shade !== 1 ? f3(Math.max(0, opts.shade)) : undefined,
  };
  let changed = false;
  for (const [k, v] of Object.entries(want)) {
    if (v === undefined) { if (k in d) { delete d[k]; changed = true; } } else if (d[k] !== v) { d[k] = v; changed = true; }
  }
  if (changed) material.needsUpdate = true;
  return material;
}

/** applyCelShading on every lit material under `root` (shared materials are set once; `skip` keeps some as they are). */
export function celScene(root: THREE.Object3D, opts: CelOpts = {}, skip?: (m: THREE.Material, o: THREE.Mesh) => boolean): void {
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      if (!skip?.(mat, m)) applyCelShading(mat, opts);
    }
  });
}

export interface CelRig { key: THREE.DirectionalLight; fill: THREE.HemisphereLight }
/**
 * The reference light rig for a small scene with no lights of its own (the HUD shelf, the cuckoo-clock stage): a warm
 * key from the upper left and a little in front (CEL_REF.light) with a soft, tight shadow, and a cool sky / warm
 * ground fill. `size` is the radius of the subject (world units) the shadow has to cover; `target` its centre.
 */
export function celLights(scene: THREE.Scene, o: { size?: number; target?: THREE.Vector3; intensity?: number; shadows?: boolean } = {}): CelRig {
  const size = o.size ?? 2, at = o.target ?? new THREE.Vector3();
  const key = new THREE.DirectionalLight(0xffe2bc, 2.6 * (o.intensity ?? 1));
  key.position.copy(at).add(new THREE.Vector3(-0.62, 0.7, 0.36).normalize().multiplyScalar(size * 4));
  key.target.position.copy(at);
  if (o.shadows !== false) {
    key.castShadow = true;
    const c = key.shadow.camera;
    Object.assign(c, { left: -size * 1.3, right: size * 1.3, top: size * 1.3, bottom: -size * 1.3, near: size * 0.5, far: size * 9 });
    c.updateProjectionMatrix();
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = size * 0.01;
  }
  const fill = new THREE.HemisphereLight(0xa9c4f0, 0x8a6a4c, 0.9 * (o.intensity ?? 1));
  scene.add(key, key.target, fill);
  return { key, fill };
}
