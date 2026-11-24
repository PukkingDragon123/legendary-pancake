// Shared look of the hollow oak: its textures (public/models/house/tex, made by art/lowpix/house/tex.py), the
// physically lit materials (bark with moss and lichen, the cut heartwood, honey boards, iron, brass, glass, lamp
// glow), the night/day looks the house drives every frame, and the see-through-walls shader patch used in the
// top-down build view (walls between the camera and the room dissolve on a pixel dither grid).
import * as THREE from 'three';
import { modelUrl } from '../../gfx/glb.ts';

/** Shared uniforms: when on, walls between the camera and the room dissolve on a dither grid. */
export const CUT = {
  uCutOn: { value: 0 },
  uCutCam: { value: new THREE.Vector3() },
  uCutCenter: { value: new THREE.Vector3() },
  /** world y above which walls may dissolve */
  uCutY: { value: 0 },
  /** world y above which everything dissolves (the floors above) */
  uCutTop: { value: 999 },
};

/** Patch a material so it honours CUT. Safe to call once per material. */
export function patchCut(m: THREE.Material) {
  if ((m as { userData: Record<string, unknown> }).userData.cut) return;
  m.userData.cut = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, CUT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvCutW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;\nuniform float uCutOn; uniform vec3 uCutCam; uniform vec3 uCutCenter; uniform float uCutY; uniform float uCutTop;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uCutOn > 0.0) {
  vec2 dp = vCutW.xz - uCutCenter.xz;
  vec2 dc = uCutCam.xz - uCutCenter.xz;
  float side = dot(normalize(dp + 1e-4), normalize(dc + 1e-4));
  vec2 q = floor(gl_FragCoord.xy / 2.0);
  float th = fract(dot(q, vec2(0.5, 0.25)) + 0.125 * mod(q.x, 2.0));
  float k = smoothstep(-0.05, 0.35, side) * smoothstep(uCutY, uCutY + 0.25, vCutW.y) * uCutOn;
  if (vCutW.y > uCutTop) k = 1.0;
  if (k > th + 0.02) discard;
}`);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|cut';
}

// ------------------------------------------------------------------ textures

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
const pending: Promise<void>[] = [];
/** Resolves once every house texture asked for so far has loaded (or failed). */
export const texturesReady = () => Promise.all(pending).then(() => undefined);

/** A tiling house texture (crisp nearest magnification, mipmapped minification). */
export function houseTex(name: string, o: { data?: boolean; smooth?: boolean } = {}): THREE.Texture {
  const key = name + (o.data ? ':d' : '');
  let t = texCache.get(key);
  if (t) return t;
  let done = () => {};
  pending.push(new Promise<void>((res) => { done = res; }));
  t = loader.load(modelUrl(`house/tex/${name}.webp`), () => done(), undefined, () => { console.warn('house texture missing', name); done(); });
  t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = o.smooth || o.data ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// ------------------------------------------------------------------ day / night looks

/** Shared looks the house drives every frame (night glow, window glass). */
export const HOUSE_LOOK = {
  /** lamp glass and candle flames: dim by day, bright (HDR, it blooms) at night */
  glow: new THREE.Color(1, 0.8, 0.5),
  /** clear window glass on open floors: a cool sheen by day, the warm room glowing through at night */
  pane: new THREE.Color(0x9fb4c4),
  paneOpacity: 0.18,
  /** the sliver of warm light between closed shutters on a locked floor */
  sliver: new THREE.Color(1, 0.7, 0.35),
};

const GLSL_NOISE = /* glsl */ `
float hhHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hhNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hhHash(i), hhHash(i + vec2(1.0, 0.0)), f.x), mix(hhHash(i + vec2(0.0, 1.0)), hhHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;

function chain(m: THREE.Material, key: string, f: (sh: THREE.WebGLProgramParametersWithUniforms) => void) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); f(sh); };
  const k = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (k ? k() : '') + '|' + key;
}

/**
 * Bark: the scan, darkened in its furrows by the vertex AO (colour.r), with moss (colour.g: where moss may grow,
 * thickest low down, on top of roots and on the shady side) and pale lichen (colour.b) laid on as crisp pixel
 * clusters that prefer the ridges.
 */
function patchBark(m: THREE.MeshStandardMaterial) {
  const moss = houseTex('moss');
  chain(m, 'bark', (sh) => {
    sh.uniforms.uMossMap = { value: moss };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMossMap;\n' + GLSL_NOISE)
      .replace('#include <color_fragment>', `
{
  vec3 bk = diffuseColor.rgb;
  float lum = dot(bk, vec3(0.299, 0.587, 0.114));
  vec2 q = floor(vMapUv * 256.0) / 256.0;
  float n0 = hhNoise(q * 7.0) * 0.55 + hhNoise(q * 19.0 + 3.1) * 0.3 + hhNoise(q * 61.0 + 7.7) * 0.15;
  float m = step(0.5, vColor.g * 1.25 + (n0 - 0.5) * 1.2 + (lum - 0.1) * 2.4 - 0.7);
  vec3 mossC = texture2D(uMossMap, vMapUv * 2.5).rgb;
  float l = step(1.12, hhNoise(q * 9.0 + 11.0) * 0.55 + hhNoise(q * 37.0) * 0.45 + vColor.b * 0.3 + (lum - 0.1) * 2.0);
  vec3 lichen = vec3(0.5, 0.56, 0.42) * (0.7 + lum * 2.5);
  bk = mix(bk, lichen, l * 0.85);
  bk = mix(bk, mossC * (0.62 + lum * 1.2), m);
  diffuseColor.rgb = bk * vColor.r;
}`);
  });
}

/** The heartwood where the dollhouse cut opens the trunk: growth rings, pale sapwood, a dark bark rim. uv.x runs
 * from the inner wall (0) to the bark (1), uv.y is height in px. */
function patchLip(m: THREE.MeshStandardMaterial) {
  chain(m, 'lip', (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLipUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLipUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLipUv;\n' + GLSL_NOISE)
      .replace('#include <color_fragment>', `
{
  float y = floor(vLipUv.y * 4.0) / 4.0;
  float r = floor(vLipUv.x * 40.0) / 40.0;
  vec3 c;
  if (r > 0.9) c = vec3(0.1, 0.065, 0.04) * (0.8 + hhNoise(vec2(r * 40.0, y * 0.7)) * 0.5);
  else if (r > 0.8) c = vec3(0.5, 0.36, 0.2) * (0.92 + hhNoise(vec2(r * 30.0, y)) * 0.12);
  else {
    float ring = fract(r * 9.0 + hhNoise(vec2(y * 0.05, 2.0)) * 0.35);
    c = vec3(0.34, 0.17, 0.07) * (ring < 0.3 ? 0.58 : 1.0) * (0.9 + hhNoise(vec2(r * 60.0, y * 0.5)) * 0.18);
    c = mix(c, vec3(0.36, 0.2, 0.09), smoothstep(0.25, 0.0, r));
  }
  diffuseColor.rgb = c * vColor.r * 0.82;
}`);
  });
}

export type HouseMat = 'bark' | 'lip' | 'deck' | 'door' | 'planks' | 'painted' | 'iron' | 'brass' | 'paint' | 'glow' | 'pane' | 'sliver' | 'dark';
const mats = new Map<string, THREE.Material>();

/** One of the oak's shared materials (made on first use). */
export function houseMat(k: HouseMat): THREE.Material {
  let m = mats.get(k);
  if (m) return m;
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, ...o });
  switch (k) {
    case 'bark': {
      const b = std({ map: houseTex('bark'), normalMap: houseTex('bark_n', { data: true }), normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.96, color: new THREE.Color(1.3, 1.22, 1.12) });
      patchBark(b);
      m = b;
      break;
    }
    case 'lip': { const l = std({ roughness: 0.9 }); patchLip(l); m = l; break; }
    case 'deck': m = std({ map: houseTex('deck'), roughness: 0.8 }); break;
    case 'door': m = std({ map: houseTex('door'), roughness: 0.72, side: THREE.DoubleSide }); break;
    case 'planks': m = std({ map: houseTex('planks'), roughness: 0.78 }); break;
    case 'painted': {
      // painted boards: the plank texture's grain under a coat of paint (the vertex colour)
      const p = std({ map: houseTex('planks'), roughness: 0.6 });
      chain(p, 'painted', (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = vec3(pow(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), 0.6) * 1.15);'); });
      m = p;
      break;
    }
    case 'iron': m = std({ color: 0x45403b, metalness: 0.35, roughness: 0.5 }); break;
    case 'brass': m = std({ color: 0xd4a656, metalness: 0.4, roughness: 0.34 }); break;
    case 'paint': m = std({ roughness: 0.66 }); break;
    case 'dark': m = std({ color: 0x1c1612, roughness: 1 }); break;
    case 'glow': m = new THREE.MeshBasicMaterial({ color: HOUSE_LOOK.glow, toneMapped: false }); break;
    case 'sliver': m = new THREE.MeshBasicMaterial({ color: HOUSE_LOOK.sliver, toneMapped: false }); break;
    case 'pane': m = new THREE.MeshBasicMaterial({ color: HOUSE_LOOK.pane, transparent: true, opacity: HOUSE_LOOK.paneOpacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); break;
  }
  if (k !== 'glow' && k !== 'sliver' && k !== 'pane') patchCut(m!);
  m!.name = 'house:' + k;
  mats.set(k, m!);
  return m!;
}

/** Copy the shared looks into the live materials (once a frame). */
export function syncLooks() {
  (mats.get('glow') as THREE.MeshBasicMaterial | undefined)?.color.copy(HOUSE_LOOK.glow);
  (mats.get('sliver') as THREE.MeshBasicMaterial | undefined)?.color.copy(HOUSE_LOOK.sliver);
  const p = mats.get('pane') as THREE.MeshBasicMaterial | undefined;
  if (p) { p.color.copy(HOUSE_LOOK.pane); p.opacity = HOUSE_LOOK.paneOpacity; }
}

// ------------------------------------------------------------------ painted signs (runtime canvas, pixel font)

/** 5 x 7 pixel capitals and digits for signs, plaques and labels. */
const FONT: Record<string, string> = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111', ' ': '00000000000000000000000000000000000',
  '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111',
  '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100', "'": '00100001000100000000000000000000000', '.': '00000000000000000000000000110001100',
  '-': '00000000000000011111000000000000000', '!': '00100001000010000100001000000000100', '&': '01100100101010001000101011001001101',
};

/** Draw text in the pixel font onto a canvas context at (x, y) top-left, scale s px per font pixel. */
export function pixelText(g: CanvasRenderingContext2D, text: string, x: number, y: number, s: number, color: string, shadow?: string) {
  const draw = (ox: number, oy: number, c: string) => {
    g.fillStyle = c;
    let cx = x + ox;
    for (const ch of text.toUpperCase()) {
      const f = FONT[ch] ?? FONT[' '];
      for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (f[j * 5 + i] === '1') g.fillRect(cx + i * s, y + oy + j * s, s, s);
      cx += 6 * s;
    }
  };
  if (shadow) draw(s, s, shadow);
  draw(0, 0, color);
}
export const textWidth = (text: string, s: number) => text.length * 6 * s - s;

/** A crisp canvas texture (nearest filtered) painted by `paint`. */
export function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  paint(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

/** Wood-grain fill for painted signs: streaky honey boards. */
export function woodFill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: [number, number, number], seed = 1) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = Math.sin((j + seed * 7) * 0.9 + Math.sin(i * 0.07 + seed) * 2.2) * 0.5 + 0.5;
    const k = 0.82 + n * 0.22 + (((i * 13 + j * 7 + seed) % 11) === 0 ? -0.08 : 0);
    g.fillStyle = `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`;
    g.fillRect(x + i, y + j, 1, 1);
  }
}
