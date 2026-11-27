// [icons8, icons9] The icon bake: every interface icon (and the main shelf's sprites, see SHELF below) is a detailed 3D
// model with realistic proportions, rendered at 256 px in soft, realistic studio light with its real material textures
// (photo-grained wood, brushed and tarnished brass, leather, cloth, paper, glass, gems), then finished
// (src/dev/paintfinish.ts) with smooth, supersampled edges and only a very faint dark edge so it stands off the panels:
// no cartoon outline, no pixelation, no palette. The app draws it smoothly at the screen's own resolution (iconset.ts).
// Symbols are real objects too: embossed and engraved metal, lacquered brass coins, forged iron. The shelf's sprites are
// drawn at 3 px per CSS px.
// The models: turned brass, carved wood, tooled leather, enamel, glass and cloth with real parts and bevels (no blocks
// and balls); the shelf's props (src/ui/chrome/props3d.ts: the oil lamp, the cuckoo clock, the journal, the shelf);
// furniture from the game's own GLBs. Textures from src/ui/chrome/paint3d.ts.
//
//   /dev-iconbake.html               bake everything and show it (big, at 1:1, on parchment and walnut)
//   /dev-iconbake.html?only=regex     just some (no atlas)
//   window.__module, window.__atlas, window.__shelfAtlas   the generated src/ui/px/icons3d.ts, public/img/ui3d.webp and
//                                     public/img/ui3d-shelf.webp (a tools script writes them)
import * as THREE from 'three';
import { instanceGLB } from '../gfx/glb.ts';
import { fbm, hash as h2, hex, type RGB } from '../ui/px/relief.ts';
import { bark, cloth, cloudTex, enamel, fitUV, flame, gem, glass, keepUV, leafTex, leather, metal, paper, scales, setSwatch, shingles, stone, swatchAt, SWATCHES, water, wax, wood, type Painted, type Swatch } from '../ui/chrome/paint3d.ts';
import {
  acornProp, at, carvedOak, oakLeafProp, ribbon, ball, circlePts, crescentPts, cuckooClock, cyl, ext, grp, journal, lathe, mesh, oilLamp, paintTex, planarUV, rrectPts, setClockHands, shape, shelf, smoothProfile, starPts, studioEnv, torus, tube,
  type O,
} from '../ui/chrome/props3d.ts';
import { paintFinish, type Art, type Group, type Passes } from './paintfinish.ts';
import * as CP from '../onboard/clockpaint.ts';
import { ICONS3D } from '../ui/px/icons3d.ts';

const q = new URLSearchParams(location.search);

// ------------------------------------------------------------------ renderer, light and the three passes
const canvas = document.createElement('canvas');
const R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
R.setPixelRatio(1);
R.setClearColor(0x000000, 0);
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = studioEnv(R);
scene.environmentIntensity = 0.6;
const hemi = new THREE.HemisphereLight(0xfff4e4, 0x6a5068, 0.5);
const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
(key.shadow as THREE.LightShadow & { intensity: number }).intensity = 0.42;
const fill = new THREE.DirectionalLight(0xd4e0ff, 0.4);
const rim = new THREE.DirectionalLight(0xe8eeff, 1.1);
/** a warm lamp close by at the top left: flat faces get a gentle fall of light across them (bands to paint with) */
const lamp = new THREE.PointLight(0xffe6c0, 1, 0, 2);
scene.add(hemi, key, key.target, fill, fill.target, rim, rim.target, lamp);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 500);
const reader = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;

/** every material gets an id (its colour in the id pass) and the finish's notes for it */
const idOf = new Map<THREE.Material, number>();
const groupInfo: Group[] = [];
function groupFor(m: THREE.Material): Group {
  const s = m as THREE.MeshStandardMaterial;
  const basic = (m as THREE.MeshBasicMaterial).isMeshBasicMaterial;
  const em = s.emissive ? s.emissiveIntensity * Math.max(s.emissive.r, s.emissive.g, s.emissive.b) : 0;
  const glow = basic || em > 0.45;
  const glossy = !glow && ((s.metalness ?? 0) > 0.4 || (s.roughness ?? 1) < 0.33 || m.transparent);
  return { glossy, glow, ...(m.userData.pix as Group | undefined) };
}
const mid = (m: THREE.Material) => { let i = idOf.get(m); if (i === undefined) { i = groupInfo.length; idOf.set(m, i); groupInfo.push(groupFor(m)); } return i; };
const groupOf = (i: number): Group => groupInfo[i] ?? {};
const idCol = (i: number) => new THREE.Color(((i % 16) * 16 + 8) / 255, ((Math.floor(i / 16) % 16) * 16 + 8) / 255, (Math.floor(i / 256) * 16 + 8) / 255);
const idMat = new Map<string, THREE.MeshBasicMaterial>();
const depthMat = new Map<number, THREE.ShaderMaterial>();
const depthU = { uNear: { value: 0 }, uFar: { value: 1 } };
function depthFor(side: THREE.Side) {
  let m = depthMat.get(side);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: depthU, side,
      vertexShader: 'varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uNear; uniform float uFar; varying float vD; void main(){ float d = clamp((vD - uNear) / (uFar - uNear), 0.0, 1.0); float v = floor(d * 65535.0); gl_FragColor = vec4(floor(v / 256.0) / 255.0, mod(v, 256.0) / 255.0, 0.0, 1.0); }',
    });
    depthMat.set(side, m);
  }
  return m;
}
/** swap every mesh's materials for a pass; returns the undo */
function swap(obj: O, pick: (m: THREE.Material, me: THREE.Mesh) => THREE.Material): () => void {
  const undo: (() => void)[] = [];
  obj.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    const old = me.material, ro = me.renderOrder;
    me.material = Array.isArray(old) ? old.map((m) => pick(m, me)) : pick(old, me);
    undo.push(() => { me.material = old; me.renderOrder = ro; });
  });
  return () => undo.forEach((f) => f());
}
function grab(W: number, H: number): Uint8ClampedArray {
  reader.canvas.width = W; reader.canvas.height = H;
  reader.clearRect(0, 0, W, H);
  reader.drawImage(R.domElement, 0, 0);
  return reader.getImageData(0, 0, W, H).data;
}
/** [icons9] -1..1: the key light and the lamp swing across the top (the gem's idle frames: its facets flash in turn) */
let lightSwing = 0;
/** light from the top left of the picture whatever way the camera looks: placed in the camera's own frame */
function placeLights(c: THREE.Vector3, size: number) {
  const fwd = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
  cam.matrixWorld.extractBasis(right, up, fwd); // fwd points from the subject towards the camera
  const put = (l: THREE.DirectionalLight, x: number, y: number, z: number) => { l.position.copy(c).addScaledVector(right, x * size * 4).addScaledVector(up, y * size * 4).addScaledVector(fwd, z * size * 4); l.target.position.copy(c); l.target.updateMatrixWorld(); };
  put(key, -0.62 + 0.5 * lightSwing, 0.78 - 0.12 * Math.abs(lightSwing), 0.72);
  lamp.position.copy(c).addScaledVector(right, -size * (0.75 - 0.9 * lightSwing)).addScaledVector(up, size * 0.95).addScaledVector(fwd, size * 1.5);
  lamp.intensity = 9 * size * size;
  put(fill, 0.85, 0.05, 0.6);
  put(rim, 0.45, 0.55, -0.9);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  Object.assign(sc, { left: -size * 1.3, right: size * 1.3, top: size * 1.3, bottom: -size * 1.3, near: size * 0.5, far: size * 9 });
  sc.updateProjectionMatrix();
}
/**
 * Render the three passes of `obj` for a `w` x `h` art sprite at `s` samples per art pixel, through the camera as the
 * caller framed it: the lit picture, a material id per sample and depth.
 */
/** [icons9] painted, not pixelated: every texture the models wear is sampled smoothly */
const smoothed = new WeakSet<THREE.Texture>();
function smoothTextures(obj: O) {
  obj.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    for (const m of Array.isArray(me.material) ? me.material : [me.material]) {
      for (const t of [(m as THREE.MeshStandardMaterial).map, (m as THREE.MeshStandardMaterial).emissiveMap, (m as THREE.MeshStandardMaterial).bumpMap, (m as THREE.MeshBasicMaterial).alphaMap]) {
        if (!t || smoothed.has(t)) continue;
        smoothed.add(t);
        if (t.magFilter !== THREE.LinearFilter) { t.magFilter = THREE.LinearFilter; t.needsUpdate = true; }
      }
    }
  });
}
function passes(obj: O, w: number, h: number, s: number, c: THREE.Vector3, size: number): Passes {
  const W = w * s, H = h * s;
  smoothTextures(obj);
  R.setSize(W, H, false);
  scene.add(obj);
  obj.updateMatrixWorld(true);
  placeLights(c, size);
  // the lit picture
  R.toneMapping = THREE.NeutralToneMapping;
  R.toneMappingExposure = 1.0;
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.needsUpdate = true;
  R.render(scene, cam);
  const rgba = grab(W, H);
  // the material ids (glass is drawn first and keeps no depth, so whatever is behind it shows its own id)
  R.toneMapping = THREE.NoToneMapping;
  R.outputColorSpace = THREE.LinearSRGBColorSpace;
  R.shadowMap.enabled = false;
  const env = scene.environment;
  scene.environment = null;
  let undo = swap(obj, (m, me) => {
    const i = mid(m), k = i + ':' + m.side + (m.transparent ? 't' : '');
    let b = idMat.get(k);
    if (!b) { b = new THREE.MeshBasicMaterial({ color: idCol(i), side: m.side, toneMapped: false, depthWrite: !m.transparent }); idMat.set(k, b); }
    if (m.transparent) me.renderOrder = -1;
    return b;
  });
  R.render(scene, cam);
  const idPx = grab(W, H);
  undo();
  const id = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++) id[i] = idPx[i * 4 + 3] > 127 ? (idPx[i * 4] >> 4) + (idPx[i * 4 + 1] >> 4) * 16 + (idPx[i * 4 + 2] >> 4) * 256 : -1;
  // depth: 0 at the front of the model's bounds .. 1 at the back
  depthU.uNear.value = cam.near; depthU.uFar.value = cam.far;
  undo = swap(obj, (m) => depthFor(m.side));
  R.render(scene, cam);
  const dPx = grab(W, H);
  undo();
  R.shadowMap.enabled = true;
  scene.environment = env;
  const depth = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) depth[i] = id[i] < 0 ? 1 : (dPx[i * 4] * 256 + dPx[i * 4 + 1]) / 65535;
  scene.remove(obj);
  return { w, h, s, rgba, id, depth };
}

// ------------------------------------------------------------------ materials: real textures, natural colours
/** the icons' texture density (repeats per model unit): a model is about two units across */
const ICON_DENS = 0.45;
type TexKind = 'enamel' | 'grain' | 'weave' | 'burlap' | 'scale' | 'leather' | 'knit' | 'bark' | 'felt' | 'paper' | 'glass' | 'water' | 'wax' | 'stone' | 'cloud' | 'leaf' | 'foliage' | 'gem' | 'metal' | 'plain';
/** the photo swatch a kind wears (tinted to the material's colour), and its repeats */
const PHOTO: Partial<Record<TexKind, [Swatch, number]>> = { grain: ['woodg', 1], leather: ['grain', 1.4], weave: ['linen', 1.6], burlap: ['linen', 1], knit: ['knit', 2.2], felt: ['velvet', 1.5] };
function painted(kind: TexKind, c: string, seed: number): Painted {
  switch (kind) {
    case 'grain': return wood(c, { seed: 3 + seed % 5, knots: 1 });
    case 'weave': return cloth(c, 'weave', 4);
    case 'burlap': return cloth(c, 'burlap', 4);
    case 'knit': return cloth(c, 'knit', 4);
    case 'felt': return cloth(c, 'felt', 4);
    case 'scale': case 'foliage': return scales(c, 13);
    case 'leather': return leather(c, { seed: 5 });
    case 'bark': return bark(c);
    case 'paper': return paper(c);
    case 'glass': return glass(c, { frost: 0.35 });
    case 'water': return water(c);
    case 'wax': return wax(c);
    case 'stone': return stone(c);
    case 'cloud': return cloudTex(c);
    case 'leaf': return leafTex(c, { seed: 3, veins: 7 });
    case 'gem': return gem(c);
    case 'metal': return metal(c, { seed: 2 + seed % 7, patina: 0.1, brush: 'u', wear: 0.3 });
    case 'plain': return enamel(c, { craze: 0, chips: false });
    default: return enamel(c, { craze: 0.3, chips: false });
  }
}

interface MOpt { metal?: number; rough?: number; tex?: TexKind | null; glow?: number; flat?: boolean; rep?: number; opacity?: number; side?: THREE.Side; env?: number; pix?: Group }
const mats = new Map<string, THREE.Material>();
/** the bake's own materials (everything else, e.g. a painted face, keeps its own texture coordinates) */
const ownMats = new Set<THREE.Material>();
/**
 * A material of `color`: photo grain tinted to it (wood, leather, cloth), or a texture painted in it (enamel unless told
 * otherwise; metal, glass, gem or a plain glaze when `tex` is null). `pix`: notes for the pixel finish.
 */
function M(color: number, o: MOpt = {}): THREE.MeshStandardMaterial {
  const k = color + JSON.stringify(o);
  let m = mats.get(k) as THREE.MeshStandardMaterial | undefined;
  if (m) return m;
  const c = '#' + color.toString(16).padStart(6, '0');
  const metallic = (o.metal ?? 0) >= 0.4 && (o.tex === 'plain' || o.tex === undefined);
  const kind: TexKind = metallic ? 'metal' : o.tex !== null && o.tex !== undefined ? o.tex : o.tex === null
    ? (o.flat ? 'gem' : (o.metal ?? 0) >= 0.4 ? 'metal' : o.opacity !== undefined || ((o.rough ?? 0.5) <= 0.1 && (o.env ?? 1) >= 1.3) ? 'glass' : 'plain')
    : 'enamel';
  const ph = PHOTO[kind], photo = ph ? swatchAt(ph[0], ph[1]) : null;
  const clean = kind === 'plain' || kind === 'gem' || kind === 'glass';
  const p = photo || clean ? null : painted(kind, c, mats.size);
  let map = photo ?? p?.map ?? null;
  // [icons9] real metal: its colour is in its reflections (near-full metalness, no painted colour map), its brushing a
  // faint relief at a fine scale
  let brush: THREE.Texture | null = null;
  if (kind === 'metal' && map) { brush = map.clone(); brush.wrapS = brush.wrapT = THREE.RepeatWrapping; brush.repeat.set(4, 4); brush.needsUpdate = true; map = null; }
  m = new THREE.MeshStandardMaterial({ color: photo ? new THREE.Color(color).multiplyScalar(1.45) : clean || brush ? color : 0xffffff, map, metalness: (o.metal ?? 0) >= 0.4 ? Math.max(0.88, o.metal ?? 0) : o.metal ?? 0, roughness: o.rough ?? 0.5, flatShading: !!o.flat, emissive: o.glow ? (map ? 0xffffff : color) : 0x000000, emissiveMap: o.glow && map ? map : null, emissiveIntensity: o.glow ?? 0, side: o.side ?? THREE.FrontSide, envMapIntensity: o.env ?? 1 });
  if (photo) { m.bumpMap = photo; m.bumpScale = 0.5; } else if (brush) { m.bumpMap = brush; m.bumpScale = 0.12; } else if (p?.bump) { m.bumpMap = p.bump; m.bumpScale = (p.bumpScale ?? 1) * 0.7; }
  if (kind === 'leaf') keepUV(m);
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.pix) m.userData.pix = o.pix;
  mats.set(k, m);
  ownMats.add(m);
  return m;
}
/** an unlit colour (flames, light) */
const unlit = (c: number) => { const k = 'unlit' + c; let m = mats.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ map: flame('#' + c.toString(16).padStart(6, '0')).map }); mats.set(k, m); ownMats.add(m); } return m; };
/**
 * The palette: natural pigments and real materials, never flat toy primaries: cinnabar, emerald, cobalt, cerulean,
 * old rose, amethyst; honey oak, walnut and cherry; warm brass and gold; cream paper and linen.
 */
const C = {
  brass: () => M(0xe4ae4a, { metal: 0.5, rough: 0.32, tex: null, env: 1.0 }), gold: () => M(0xf0c04c, { metal: 0.55, rough: 0.27, tex: null, env: 1.15 }), silver: () => M(0xd2d9e2, { metal: 0.75, rough: 0.28, tex: null }),
  iron: () => M(0x88909e, { metal: 0.7, rough: 0.38, tex: null }), wood: () => M(0xb8723c, { tex: 'grain', rough: 0.6 }), dark: () => M(0x6e3c20, { tex: 'grain', rough: 0.65 }), oak: () => M(0xd8a05c, { tex: 'grain', rough: 0.6 }),
  red: () => M(0xa83a2e, { rough: 0.42 }), green: () => M(0x3c7a4a, { rough: 0.42 }), blue: () => M(0x345a8e, { rough: 0.42 }), sky: () => M(0x5a8cb4, { rough: 0.4 }),
  rose: () => M(0xb45a68, { rough: 0.42 }), plum: () => M(0x6a4690, { rough: 0.44 }), cream: () => M(0xeee2c6, { rough: 0.5 }), paper: () => M(0xf2e4c4, { rough: 0.85, tex: 'paper' }),
  leaf: () => M(0x56a43c, { rough: 0.5, tex: 'leaf' }), leather: () => M(0xa8432e, { rough: 0.55, tex: 'leather' }), burlap: () => M(0xc89a5c, { rough: 0.9, tex: 'burlap', rep: 2 }), white: () => M(0xf6f0e4, { rough: 0.4 }),
  ink: () => M(0x2e2436, { rough: 0.45, tex: null }), flame: () => unlit(0xff7a1c), flameIn: () => unlit(0xffd84a), glass: () => M(0xc0e4f4, { rough: 0.06, metal: 0.1, tex: null, env: 1.5 }),
  kraft: () => M(0xd0a066, { rough: 0.85, tex: 'paper' }), snow: () => M(0xeef3fa, { rough: 0.45, tex: 'cloud' }), steel: () => M(0xa8b0bc, { metal: 0.8, rough: 0.3, tex: null }),
};

// ------------------------------------------------------------------ modelling helpers
type P2 = [number, number];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const nrm = (a: P2): P2 => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
/** a thick stroke along a polyline as a closed outline (mitred joints, round caps): a pen stroke to extrude */
function strokePts(pts: P2[], w: number, caps = 8): P2[] {
  const hw = w / 2, L: P2[] = [], Rt: P2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const d0 = i > 0 ? nrm(sub(p, pts[i - 1])) : nrm(sub(pts[1], p));
    const d1 = i < pts.length - 1 ? nrm(sub(pts[i + 1], p)) : d0;
    const n0: P2 = [-d0[1], d0[0]], n1: P2 = [-d1[1], d1[0]];
    const m = nrm([n0[0] + n1[0], n0[1] + n1[1]]), k = hw / Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
    L.push([p[0] + m[0] * k, p[1] + m[1] * k]); Rt.push([p[0] - m[0] * k, p[1] - m[1] * k]);
  }
  const arc = (c: P2, from: P2, sweep: number): P2[] => { const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]); return Array.from({ length: caps - 1 }, (_, i) => { const a = a0 + (sweep * (i + 1)) / caps; return [c[0] + Math.cos(a) * hw, c[1] + Math.sin(a) * hw] as P2; }); };
  const last = pts.length - 1;
  return [...L, ...arc(pts[last], L[last], -Math.PI), ...Rt.reverse(), ...arc(pts[0], Rt[Rt.length - 1], -Math.PI)];
}
/** an extruded stroke (a cut, chamfered strip) */
const strokeMesh = (pts: P2[], w: number, m: THREE.Material, depth = 0.22, bev = 0.1) => ext(shape(strokePts(pts, w)), depth * 0.6, m, Math.min(bev, 0.04), 3);
/** a round enamel button with a turned brass rim, facing the viewer */
function button(r: number, m: THREE.Material): O {
  return grp(ext(shape(circlePts(r, 64)), 0.22, m, 0.1, 4, 48), at(torus(r + 0.02, 0.07, C.brass(), Math.PI * 2, 10, 64), 0, 0, 0.0));
}
/** the outline pushed out by d (smooth shapes; either winding) */
function offsetPts(pts: P2[], d: number): P2[] {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area > 0 ? 1 : -1, n = pts.length;
  return pts.map((p, i) => { const t = nrm(sub(pts[(i + 1) % n], pts[(i - 1 + n) % n])); return [p[0] + t[1] * sg * d, p[1] - t[0] * sg * d] as P2; });
}
/** a polygon with its corners rounded off (radius r, n points per corner) */
function roundPoly(pts: P2[], r: number, n = 4): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.min(r, da / 2.2, db / 2.2);
    const p1: P2 = [p[0] + ((a[0] - p[0]) / da) * k, p[1] + ((a[1] - p[1]) / da) * k], p2: P2 = [p[0] + ((b[0] - p[0]) / db) * k, p[1] + ((b[1] - p[1]) / db) * k];
    for (let j = 0; j <= n; j++) { const t = j / n, u = 1 - t; out.push([u * u * p1[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * p[1] + t * t * p2[1]]); }
  }
  return out;
}
/** [icons9] the symbols' colour: lacquered brass in a muted natural pigment (brushed, a little worn), not a toy glaze */
function glaze(c: number): THREE.MeshStandardMaterial {
  const col = new THREE.Color(c), hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  col.setHSL(hsl.h, hsl.s * 0.62, hsl.l * 0.86);
  return M(col.getHex(), { rough: 0.38, metal: 0.3, tex: 'metal', env: 1.0 });
}
/**
 * [icons9] The symbols as real objects: a shape cut from lacquered sheet brass, a fine chamfer on its edges, set on a thin
 * plate of bare brass a little bigger than it (realistic thicknesses, nothing puffy).
 */
function jewel(pts: P2[], m: THREE.Material, o: { depth?: number; bevel?: number; rim?: number; rimM?: THREE.Material; z?: number } = {}): THREE.Group {
  const depth = Math.min(0.08, (o.depth ?? 0.16) * 0.5), bev = Math.min(0.035, (o.bevel ?? 0.13) * 0.3), rim = Math.min(0.045, (o.rim ?? 0.075) * 0.6);
  const face = ext(shape(pts), depth, m, bev, 3, 48);
  const g = grp(face);
  if (rim > 0) g.add(at(ext(shape(offsetPts(pts, bev * 0.85 + rim)), depth * 0.45, o.rimM ?? C.brass(), rim * 0.4, 2, 48), 0, 0, -depth * 0.35));
  g.position.z = o.z ?? 0;
  return g;
}
/** a stroke (a polyline of width w) in the jewel style */
const jewelStroke = (pts: P2[], w: number, m: THREE.Material, o: Parameters<typeof jewel>[2] = {}) => jewel(strokePts(pts, w, 10), m, o);
/** a faceted solid from an outline that is star-shaped about its centre: flat facets rise from every corner to a raised
 * point in the middle (a cut-metal star, a gem), with straight sides and a flat back */
function facetSolid(pts: P2[], rise: number, depth: number, m: THREE.Material, cx = 0, cy = 0): THREE.Mesh {
  const P: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => P.push(...a, ...b, ...c);
  const n = pts.length, top = depth / 2, bot = -depth / 2;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const ccw = area > 0;
  for (let k = 0; k < n; k++) {
    const i = ccw ? k : n - 1 - k, j = ccw ? (k + 1) % n : (n - 2 - k + n) % n;
    const a = pts[i], b = pts[j];
    tri([cx, cy, top + rise], [a[0], a[1], top], [b[0], b[1], top]);
    tri([a[0], a[1], top], [a[0], a[1], bot], [b[0], b[1], bot]);
    tri([a[0], a[1], top], [b[0], b[1], bot], [b[0], b[1], top]);
    tri([cx, cy, bot], [b[0], b[1], bot], [a[0], a[1], bot]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  planarUV(g);
  return mesh(g, m);
}
/** a cut-gold star: ridged points */
const goldStar = (R: number, r: number, n = 5, m: THREE.Material = gilt()) => facetSolid(starPts(R, r, n), R * 0.32, R * 0.16, m);
const HEART: P2[] = Array.from({ length: 72 }, (_, i) => { const t = (i / 72) * Math.PI * 2; return [(16 * Math.sin(t) ** 3) / 16 * 0.9, ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16) * 0.9 + 0.1] as P2; });
/** an arrow pointing right (rotate it for the others), its corners softened */
const ARROW: P2[] = roundPoly([[-0.82, -0.2], [0.06, -0.2], [0.06, -0.56], [0.84, 0], [0.06, 0.56], [0.06, 0.2], [-0.82, 0.2]], 0.07);
const rot = (pts: P2[], a: number): P2[] => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const mirrorX = (pts: P2[]): P2[] => pts.map(([x, y]) => [-x, y] as P2).reverse();
/** a curved arrow round the centre (a refresh), clockwise when `cw` */
function curvedArrow(m: THREE.Material, cw: boolean): THREE.Group {
  // [icons10] one outline (the band and its head together) so the cloisonné wire runs round it unbroken
  const a0 = cw ? 2.2 : 0.94, a1 = cw ? -2.0 : 5.14, R = 0.62, n = 40, w = 0.24, arc: P2[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; arc.push([Math.cos(a) * R, Math.sin(a) * R]); }
  const end = arc[n], tan = nrm(sub(arc[n], arc[n - 1]));
  const side = (k: number) => arc.map(([x, y]) => { const l = Math.hypot(x, y); return [x + (x / l) * k, y + (y / l) * k] as P2; });
  const out = side(w / 2), inn = side(-w / 2), ux = end[0] / R, uy = end[1] / R;
  const head: P2[] = [[end[0] + ux * 0.3, end[1] + uy * 0.3], [end[0] + tan[0] * 0.36, end[1] + tan[1] * 0.36], [end[0] - ux * 0.3, end[1] - uy * 0.3]];
  const t0 = nrm(sub(arc[1], arc[0])), r0: P2 = [arc[0][0] / R, arc[0][1] / R];
  const cap: P2[] = Array.from({ length: 9 }, (_, i) => { const t = (Math.PI * (i + 1)) / 10; return [arc[0][0] - Math.cos(t) * r0[0] * (w / 2) - Math.sin(t) * t0[0] * (w / 2), arc[0][1] - Math.cos(t) * r0[1] * (w / 2) - Math.sin(t) * t0[1] * (w / 2)] as P2; });
  return cloison(roundPoly([...out.slice(0, n), ...head, ...inn.slice(0, n).reverse(), ...cap], 0.03, 3), m);
}
/** [icons9] a struck medallion: a lacquered disc in a turned brass rim, its glyph raised in bare brass (a coin's thickness) */
function enamelButton(m: THREE.Material, glyph: P2[][]): THREE.Group {
  const g = grp(ext(shape(circlePts(0.8, 64)), 0.09, m, 0.025, 3, 64), at(torus(0.84, 0.055, C.brass(), Math.PI * 2, 12, 72), 0, 0, 0));
  for (const p of glyph) g.add(at(ext(shape(p), 0.04, C.brass(), 0.018, 2, 32), 0, 0, 0.075));
  return g;
}
const bar = (w: number, h: number, x = 0, y = 0): P2[] => rrectPts(w, h, Math.min(w, h) * 0.3).map(([px, py]) => [px + x, py + y] as P2);
/** a little sunny landscape for the wall-art icon */
function landscape(): THREE.Texture {
  return paintTex('landscape', 48, 36, (x, y) => {
    const sky = [hex('#6aa8d8'), hex('#8cc0e4'), hex('#b8d8ec')][Math.min(2, Math.floor(y / 6))];
    const h1 = 20 + Math.sin(x * 0.12) * 3, h2 = 25 + Math.sin(x * 0.2 + 2) * 2;
    if (Math.hypot(x - 36, y - 8) < 4) return hex('#ffe08a');
    const tx = x - 14, ty = y - 15;
    if (Math.hypot(tx, ty) < 6 && ty < 3) return ty < -2 ? hex('#5a9a40') : hex('#3e7a34');
    if (Math.abs(tx) < 1.2 && ty >= 3 && y < h1 + 2) return hex('#6a4426');
    if (y > h2) return y > 31 ? hex('#4a8434') : hex('#64a044');
    if (y > h1) return hex('#7ab452');
    return sky;
  });
}
/** a simple dial for the small clocks: cream enamel, a brass ring, twelve hour ticks (the hands are on top) */
function pixelDial(): THREE.Texture {
  return paintTex('pixdial', 64, 64, (x, y) => {
    const dx = x - 31.5, dy = y - 31.5, r = Math.hypot(dx, dy) / 31.5;
    if (r > 0.93) return hex('#b48a46');
    const a = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1, k = Math.round(a * 12) % 12, ad = Math.abs(a * 12 - Math.round(a * 12));
    return r > 0.62 && r < 0.84 && ad < (k % 3 === 0 ? 0.24 : 0.13) ? hex('#34262e') : hex('#f2e6c8');
  });
}
function boldHands(c: { hour: O; minute: O }) { for (const h of [c.hour, c.minute]) h.children.forEach((k) => k.scale.set(k.scale.x * 1.9, k.scale.y, k.scale.z)); }
function simpleDial(root: O): O {
  const d = root.getObjectByName('dial') as THREE.Mesh | undefined;
  if (d) d.material = new THREE.MeshStandardMaterial({ map: pixelDial(), roughness: 0.4 });
  return root;
}
const V2c = (x: number, y: number) => new THREE.Vector2(x, y);
/** the moon's face: pale gold with soft craters (laid flat on the crescent) */
function moonFace(): THREE.MeshStandardMaterial {
  const R = [hex('#b87a2e'), hex('#d89c40'), hex('#ecbe5c'), hex('#f6d47a'), hex('#fde8a8')];
  const cr: [number, number, number][] = [[0.3, 0.32, 0.09], [0.22, 0.62, 0.07], [0.42, 0.78, 0.05], [0.16, 0.44, 0.04], [0.36, 0.5, 0.05]];
  const t = paintTex('moonface', 64, 64, (x, y) => {
    const u = x / 63, v = 1 - y / 63;
    let k = 3;
    for (const [cx, cy, r] of cr) { const d = Math.hypot(u - cx, v - cy) / r; if (d < 1) k = Math.min(k, d < 0.7 ? 1 : 2); else if (d < 1.3) k = Math.max(k, 3); }
    return R[k];
  });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, emissive: 0x6a4010, emissiveIntensity: 0.15 });
  return m;
}
/** a crescent moon jewel: its face planar-mapped so the craters sit on the front */
function moonJewel(R: number, cut: number, off: [number, number]): THREE.Group {
  const j = jewel(crescentPts(R, cut, off), moonFace(), { depth: 0.2, bevel: 0.14, rimM: M(0xc08a30, { metal: 0.6, rough: 0.35, tex: null }) });
  planarUV((j.children[0] as THREE.Mesh).geometry);
  return j;
}
/** [icons9] a glossy acorn (the packs, heaps): the currency's acorn, smaller; scales only where they can show */
function acorn(s = 1, tilt = 0): THREE.Group { return acorn9(s * 0.7, tilt, s >= 0.5); }
/** a lobed oak leaf blade, base at the origin pointing up, bent a little (veins painted in its texture) */
function oakLeaf(len: number, m: THREE.Material): THREE.Mesh {
  const pts: P2[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, a = t * Math.PI * 2, y = (1 - Math.cos(a)) / 2;
    const lobes = 1 + 0.32 * Math.abs(Math.sin(y * Math.PI * 4.5));
    pts.push([Math.sin(a) * 0.3 * len * Math.sin(Math.PI * Math.pow(y, 0.85)) * lobes, y * len]);
  }
  const me = ext(shape(pts), 0.03, m, 0.025, 2, 80);
  planarUV(me.geometry);
  const p = me.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - Math.abs(p.getX(i)) * 0.4 + Math.sin((p.getY(i) / len) * Math.PI) * len * 0.08);
  me.geometry.computeVertexNormals();
  return me;
}
/** the acorn bag: a plump burlap sack tied at the neck with a red cord and bow, its ruffled top standing up, a golden
 * acorn stitched on the front, glossy acorns spilled at its foot */
function acornBag(o: { squash?: number; pouch?: 'burlap' | 'leather'; spill?: number } = {}): THREE.Group {
  const sq = o.squash ?? 0, leather = o.pouch === 'leather';
  const m = leather ? M(0x7e3426, { rough: 0.55, tex: 'leather' }) : M(0xa8875a, { rough: 0.92, tex: 'burlap', rep: 2 });
  const prof: [number, number][] = [[0, -0.8], [0.5, -0.78], [0.76, -0.6], [0.86, -0.3], [0.82, 0.0], [0.64, 0.24], [0.38, 0.4], [0.24, 0.46], [0.26, 0.54], [0.4, 0.68], [0.52, 0.84], [0.46, 0.9], [0.3, 0.8], [0.12, 0.7], [0, 0.68]];
  const body = lathe(prof, m, 48);
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
    const ruffle = y > 0.56 ? 1 + Math.sin(a * 7) * 0.09 + Math.sin(a * 13 + 1) * 0.03 : 1;
    const k = (1 + Math.sin(a * 3 + y * 2) * 0.05 + Math.sin(a * 5 - 1) * 0.03) * ruffle;
    pos.setXYZ(i, x * k * (1 + sq * 0.5), (y > 0.56 ? y + Math.sin(a * 7) * 0.04 : y) * (1 - sq), z * k * (1 + sq * 0.5));
  }
  body.geometry.computeVertexNormals();
  const RED = M(0x8a2e24, { rough: 0.7, tex: 'weave' });
  const cord = at(torus(0.28, 0.08, RED, Math.PI * 2, 10, 32), 0, 0.46 * (1 - sq), 0, Math.PI / 2, 0, 0);
  const bow = grp(at(torus(0.15, 0.06, RED, Math.PI * 2, 8, 24), -0.16, 0, 0, 0, 0.3, 0), at(torus(0.15, 0.06, RED, Math.PI * 2, 8, 24), 0.16, 0, 0, 0, -0.3, 0), at(ball(0.08, RED), 0, 0, 0.02),
    strokeMesh([[-0.02, -0.02], [-0.16, -0.36]], 0.09, RED, 0.03, 0.02), strokeMesh([[0.02, -0.02], [0.18, -0.36]], 0.09, RED, 0.03, 0.02));
  at(bow, 0.04, 0.44 * (1 - sq), 0.3);
  const g = grp(body, cord, bow);
  const spill = o.spill ?? 2;
  if (spill > 0) g.add(at(acorn(0.6, 0.6), 0.7, -0.56, 0.52));
  if (spill > 1) g.add(at(acorn(0.5, -0.55), -0.64, -0.64, 0.5));
  return g;
}
/** a little heap of acorns (each turned its own way), centred on (x, y, z) */
function acornHeap(n: number, s: number, x = 0, y = 0, z = 0, spread = 0.5): THREE.Group {
  const g = grp();
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = spread * Math.sqrt((i + 0.5) / n);
    g.add(at(acorn(s, Math.sin(i * 1.7) * 0.9), x + Math.cos(a) * r, y + (1 - r / spread) * s * 0.5 + (i % 3) * 0.02, z + Math.sin(a) * r * 0.6 + 0.1));
  }
  return g;
}
/** an open sack (burlap or a leather pouch) with a rolled lip, full to the brim with acorns */
function openSack(m: THREE.Material, n: number, s: number, cord?: THREE.Material): THREE.Group {
  const prof: [number, number][] = [[0, -0.8], [0.46, -0.78], [0.72, -0.6], [0.82, -0.3], [0.78, 0.0], [0.62, 0.26], [0.56, 0.38], [0.6, 0.48], [0.66, 0.52], [0.62, 0.56], [0.52, 0.5], [0.46, 0.3]];
  const body = lathe(smoothProfile(prof, 3), m, 48);
  (body.material as THREE.Material).side = THREE.DoubleSide;
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 3 + y * 2) * 0.05 + (y > 0.4 ? Math.sin(a * 9) * 0.05 : 0); pos.setXYZ(i, x * k, y, z * k); }
  body.geometry.computeVertexNormals();
  const g = grp(body, acornHeap(n, s, 0, 0.42, 0, 0.42));
  if (cord) g.add(at(torus(0.58, 0.045, cord, Math.PI * 2, 8, 48), 0, 0.34, 0, Math.PI / 2));
  return g;
}
/** [icons9] the moon gem (in the vault and the things icon): the currency's gem, its moon left out */
const moonGem = (): O => moonGem9(false);
/** a puffy cloud: an outline of overlapping bumps, extruded with a deep rounded bevel */
function cloud(m: THREE.Material): O {
  const bumps: [number, number, number][] = [[-0.5, -0.05, 0.36], [-0.12, 0.2, 0.46], [0.34, 0.12, 0.38], [0.62, -0.08, 0.28], [0.05, -0.18, 0.4]];
  const pts: P2[] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2, dir: P2 = [Math.cos(a), Math.sin(a)];
    let best = 0;
    for (const [bx, by, br] of bumps) { const t = bx * dir[0] + by * dir[1], d2 = br * br - (bx * bx + by * by - t * t); if (d2 > 0) best = Math.max(best, t + Math.sqrt(d2)); }
    pts.push([dir[0] * best, Math.max(-0.3, dir[1] * best)]);
  }
  return ext(shape(pts), 0.3, m, 0.18, 5, 64);
}
/** a leaf blade with a midrib, bent a little */
function leafMesh(len: number, wid: number, m: THREE.Material, serr = 0): THREE.Mesh {
  const pts: P2[] = [];
  for (let i = 0; i <= 60; i++) { const t = (i / 60) * Math.PI * 2, y = Math.cos(t); const k = 1 + (serr ? Math.sin(t * serr) * 0.08 : 0); pts.push([Math.sin(t) * wid * (1 - 0.35 * Math.max(0, y)) * (1 - 0.2 * Math.max(0, -y)) * k, y * len]); }
  const me = ext(shape(pts), 0.04, m, 0.03, 2, 60);
  planarUV(me.geometry);
  const p = me.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - Math.abs(p.getX(i)) * 0.35 + (p.getY(i) / len) ** 2 * 0.12);
  me.geometry.computeVertexNormals();
  return me;
}
/** a flat texture painted for a face (planar UV) */
function faceTex(key: string, w: number, h: number, f: (x: number, y: number) => RGB): THREE.Texture { return paintTex('iconface-' + key, w, h, f); }

// ------------------------------------------------------------------ [icons9] the side tools, the door and the currency, remade
// Each says what it does at a glance: a market stall with a striped awning and an acorn sign (Shop), a rolled blueprint
// with a pencil (Build), a top hat with a feather (Dress up), a globe on a brass stand (Map), a round hobbit door
// (Outside; ajar with warm light for Inside), a checklist scroll (Quests). Painted faces are drawn texel by texel so
// one texel lands on about one art pixel at 44 px.
/** a texture drawn with canvas strokes at `w` x `h` (smooth, mipmapped), cached by key */
const drawnTex = new Map<string, THREE.Texture>();
function drawTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  let t = drawnTex.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  drawnTex.set(key, t);
  return t;
}
/** a little paper grain over a drawn face (fibres and blotches), `a` strong */
function grain(g: CanvasRenderingContext2D, w: number, h: number, a: number, light = true) {
  const im = g.getImageData(0, 0, w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (fbm(x * 0.06, y * 0.06, 3) - 0.5) * 2 + (h2(x, y, 7) - 0.5) * 0.6, k = 1 + v * a * (light ? 1 : 0.8), i = (y * w + x) * 4;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  g.putImageData(im, 0, 0);
}
/** a material for a painted face that keeps its own texture coordinates */
function faceMat(map: THREE.Texture, o: { rough?: number; side?: THREE.Side; pix?: Group; glow?: number; metal?: number } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, side: o.side ?? THREE.FrontSide, emissive: o.glow ? 0xffffff : 0x000000, emissiveMap: o.glow ? map : null, emissiveIntensity: o.glow ?? 0 });
  if (o.pix) m.userData.pix = o.pix;
  return m;
}
/** an arc of points (centre, radius, from, to), `n` steps */
const arcPts = (cx: number, cy: number, r: number, a0: number, a1: number, n = 24): P2[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as P2; });

// ---- Shop: a little market stall
function shopStall(): O {
  const honey = M(0xc8843e, { tex: 'grain', rough: 0.55 }), walnut = M(0x7a4426, { tex: 'grain', rough: 0.6 }), dark = M(0x5c3220, { tex: 'grain', rough: 0.6 });
  const red = M(0xd0382e, { rough: 0.55, tex: 'weave' }), cream = M(0xf8ecd0, { rough: 0.6, tex: 'weave' });
  const g = grp();
  // the counter: a walnut box faced with four honey planks, a dark top board
  g.add(at(ext(shape(rrectPts(1.5, 0.62, 0.02)), 0.56, walnut, 0.01, 1), 0, -0.55, 0));
  for (let i = 0; i < 4; i++) g.add(at(ext(shape(rrectPts(0.365, 0.6, 0.025)), 0.06, honey, 0.025, 2), -0.565 + i * 0.377, -0.56, 0.3));
  g.add(at(ext(shape(rrectPts(1.68, 0.09, 0.03)), 0.74, dark, 0.025, 2), 0, -0.2, 0.03));
  // the back wall: dark planks; a shelf of little jars
  for (let i = 0; i < 5; i++) g.add(at(ext(shape(rrectPts(0.29, 0.86, 0.02)), 0.05, i % 2 ? walnut : dark, 0.015, 1), -0.6 + i * 0.3, 0.22, -0.3));
  g.add(at(ext(shape(rrectPts(1.4, 0.05, 0.015)), 0.2, honey, 0.012, 1), 0, 0.2, -0.2));
  const jar = (x: number, col: number) => grp(at(lathe(smoothProfile([[0, 0], [0.08, 0], [0.09, 0.04], [0.09, 0.14], [0.065, 0.17], [0, 0.17]], 2), M(col, { rough: 0.12, metal: 0.1, tex: null, env: 1.3 }), 20), x, 0.225, -0.18), at(cyl(0.07, 0.07, 0.035, C.brass(), 16), x, 0.41, -0.18));
  g.add(jar(-0.45, 0x5a9ad8), jar(-0.15, 0x6ab85a), jar(0.15, 0xe0a030), jar(0.45, 0xd8708a));
  // the posts
  for (const x of [-0.76, 0.76]) g.add(at(cyl(0.05, 0.055, 0.82, dark, 12), x, 0.2, 0.33), at(cyl(0.05, 0.05, 0.9, dark, 12), x, 0.24, -0.3));
  // the striped awning, sloping down to the front, a brass rod and a scalloped valance along its edge
  const N = 7, W = 1.92, sw = W / N;
  const aw = grp();
  for (let i = 0; i < N; i++) { const st = ext(shape(rrectPts(sw + 0.004, 0.86, 0.01)), 0.035, i % 2 ? cream : red, 0.012, 1); st.castShadow = false; aw.add(at(st, -W / 2 + sw * (i + 0.5), 0, 0)); }
  g.add(at(aw, 0, 0.63, 0.06, -1.12, 0, 0));
  const fy = 0.63 - 0.43 * Math.cos(1.12), fz = 0.06 + 0.43 * Math.sin(1.12);
  g.add(at(cyl(0.026, 0.026, W + 0.08, C.brass(), 10), 0, fy, fz + 0.01, 0, 0, Math.PI / 2));
  for (let i = 0; i < N; i++) {
    const pts: P2[] = [[-sw / 2, 0.06], [sw / 2, 0.06], ...arcPts(0, -0.04, sw / 2, 0, -Math.PI, 10).slice(0, -1), [-sw / 2, -0.04]];
    const sc = ext(shape(pts), 0.03, i % 2 ? cream : red, 0.012, 1);
    sc.castShadow = false;
    g.add(at(sc, -W / 2 + sw * (i + 0.5), fy - 0.07, fz + 0.03));
  }
  g.add(at(cyl(0.05, 0.05, W + 0.04, dark, 10), 0, 0.63 + 0.43 * Math.cos(1.12), 0.06 - 0.43 * Math.sin(1.12), 0, 0, Math.PI / 2));
  // the sign on top: an arched board with a brass rim and a golden acorn
  const board: P2[] = rrectPts(1.0, 0.44, 0.12);
  const sign = grp(ext(shape(board), 0.07, M(0xf4e2b8, { tex: 'grain', rough: 0.6 }), 0.03, 2), at(ext(shape(offsetPts(board, 0.055)), 0.04, C.gold(), 0.025, 2), 0, 0, -0.03),
    ...[-0.34, 0.34].map((x) => at(goldStar(0.07, 0.03, 4), x, 0, 0.06)));
  // the sign's acorn: a glossy golden nut and a scaly brown cap in relief
  const nutS = shape(Array.from({ length: 32 }, (_, i) => { const t = (i / 32) * Math.PI * 2, y = Math.cos(t); return [Math.sin(t) * 0.15 * (y < 0 ? 1 - -y * 0.45 : 1), y * 0.17 - 0.08] as P2; }));
  const capS = shape([...arcPts(0, 0.02, 0.19, 0, Math.PI, 16), [-0.19, -0.01], [0.19, -0.01]]);
  sign.add(at(grp(at(ext(nutS, 0.05, M(0xc8762a, { rough: 0.2, tex: 'plain', env: 1.2 }), 0.035, 3), 0, -0.03, 0), at(ext(capS, 0.05, M(0x6a4428, { rough: 0.7, tex: 'scale' }), 0.03, 2), 0, 0.03, 0.015), at(cyl(0.02, 0.02, 0.1, C.dark(), 6), 0.02, 0.24, 0.02, 0, 0, -0.35)), 0, -0.04, 0.06, 0, 0, 0, 0.82));
  g.add(at(sign, 0, 1.03, -0.26));
  for (const x of [-0.3, 0.3]) g.add(at(cyl(0.02, 0.02, 0.12, C.iron(), 6), x, 0.8, -0.27));
  // the goods: a honey pot with a cloth cap, red apples, a little sack of acorns
  const pot = grp(lathe(smoothProfile([[0, 0], [0.1, 0], [0.13, 0.08], [0.12, 0.2], [0.09, 0.24], [0, 0.24]], 2), M(0xe8a032, { rough: 0.14, metal: 0.1, tex: null, env: 1.3, glow: 0.08 }), 24),
    at(lathe(smoothProfile([[0, 0.06], [0.12, 0.04], [0.15, -0.02], [0.13, -0.05], [0, -0.03]], 2), M(0xd84a3a, { rough: 0.6, tex: 'weave' }), 20), 0, 0.25, 0));
  g.add(at(pot, -0.52, -0.155, 0.08));
  const apple = (x: number, y: number, z: number, s: number) => at(grp(lathe(smoothProfile([[0, -0.1], [0.07, -0.095], [0.11, -0.03], [0.105, 0.04], [0.06, 0.085], [0.015, 0.07], [0, 0.06]], 3), M(0xd8322a, { rough: 0.22 }), 20), at(cyl(0.008, 0.01, 0.06, C.dark(), 5), 0.005, 0.09, 0, 0, 0, -0.3)), x, y, z, 0, 0, 0, s);
  g.add(apple(-0.16, -0.065, 0.1, 1), apple(0.03, -0.065, 0.13, 1.05), apple(-0.06, 0.06, 0.08, 0.95));
  g.add(at(acornBag({ spill: 0 }), 0.46, -0.03, 0.06, 0, 0.2, 0, 0.18));
  return g;
}

// ---- Build: a blueprint, half unrolled, a pencil across it
function blueprintTex(): THREE.Texture {
  return drawTex('blueprint', 256, 240, (g) => {
    const W = 256, H = 240;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1e4a8c'); bg.addColorStop(1, '#173c76');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(140,190,240,0.28)'; g.lineWidth = 1.5;
    for (let x = 8; x < W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 8; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = 'rgba(200,228,255,0.8)'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
    // a little house: roof, walls, chimney, door, windows, and its measurements
    const ink = (wd: number, a = 0.97) => { g.strokeStyle = `rgba(244,250,255,${a})`; g.lineWidth = wd; };
    ink(6);
    g.beginPath(); g.moveTo(34, 104); g.lineTo(128, 36); g.lineTo(222, 104); g.stroke();
    g.strokeRect(54, 104, 148, 86);
    g.strokeRect(160, 44, 20, 34);
    ink(5);
    g.strokeRect(110, 132, 36, 58);
    g.beginPath(); g.arc(138, 162, 2.5, 0, Math.PI * 2); g.stroke();
    for (const x of [68, 166]) { g.strokeRect(x, 122, 26, 26); ink(2.5, 0.8); g.beginPath(); g.moveTo(x + 13, 122); g.lineTo(x + 13, 148); g.moveTo(x, 135); g.lineTo(x + 26, 135); g.stroke(); ink(5); }
    ink(2.5, 0.75);
    g.beginPath(); g.moveTo(54, 212); g.lineTo(202, 212); g.moveTo(54, 204); g.lineTo(54, 220); g.moveTo(202, 204); g.lineTo(202, 220); g.stroke();
    g.beginPath(); g.moveTo(224, 104); g.lineTo(224, 190); g.moveTo(216, 104); g.lineTo(232, 104); g.moveTo(216, 190); g.lineTo(232, 190); g.stroke();
    grain(g, W, H, 0.06);
  });
}
function blueprint(): O {
  const sheetG = new THREE.PlaneGeometry(1.36, 1.3, 14, 14);
  const p = sheetG.attributes.position as THREE.BufferAttribute;
  // a gentle wave across, the bottom-left corner curling up
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(((x + 0.68) / 1.36) * Math.PI * 1.2) * 0.04 + Math.max(0, -0.3 - x - y) ** 2 * 0.5); }
  sheetG.computeVertexNormals();
  const sheetM = faceMat(blueprintTex(), { rough: 0.85, side: THREE.DoubleSide, pix: { flat: true } });
  const sheet = mesh(sheetG, sheetM);
  // the roll at the right edge: the same blue paper, a white spiral where it is cut
  const blue = M(0x1450a8, { rough: 0.7, tex: 'paper' });
  const spiral = drawTex('spiral', 96, 96, (g) => {
    g.fillStyle = '#1450a8'; g.fillRect(0, 0, 96, 96);
    g.strokeStyle = '#eef6ff'; g.lineWidth = 3.2; g.beginPath();
    for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2 * 4.2, r = 6 + (i / 200) * 40; const x = 48 + Math.cos(a) * r, y = 48 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  });
  const endM = faceMat(spiral, { rough: 0.8, pix: { flat: true } });
  const roll = grp(cyl(0.17, 0.17, 1.42, blue, 28), ...[0.711, -0.711].map((y) => at(mesh(planarUV(new THREE.CircleGeometry(0.168, 28)), endM), 0, y, 0, y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0)));
  // the pencil: yellow hexagonal lacquer, a brass ferrule and a pink eraser, a sharpened cedar point
  const lac = M(0xf6b830, { rough: 0.3, tex: 'plain', flat: true });
  const pencil = grp(mesh(new THREE.CylinderGeometry(0.095, 0.095, 1.2, 6), lac),
    at(lathe(smoothProfile([[0.095, 0], [0.06, 0.12], [0.025, 0.21]], 2), M(0xecc690, { rough: 0.7, tex: 'grain' }), 12), 0, 0.6, 0), at(lathe([[0.027, 0], [0.01, 0.07], [0, 0.085]], M(0x3a3440, { rough: 0.4, tex: null }), 10), 0, 0.81, 0),
    at(cyl(0.1, 0.1, 0.13, C.brass(), 14), 0, -0.665, 0), at(torus(0.1, 0.014, C.gold(), Math.PI * 2, 6, 16), 0, -0.63, 0, Math.PI / 2), at(torus(0.1, 0.014, C.gold(), Math.PI * 2, 6, 16), 0, -0.7, 0, Math.PI / 2),
    at(lathe(smoothProfile([[0.095, 0], [0.096, -0.09], [0.075, -0.15], [0, -0.165]], 2), M(0xec7a8c, { rough: 0.6 }), 14), 0, -0.73, 0));
  return at(grp(at(sheet, -0.12, 0, 0), at(roll, 0.72, 0, 0.12), at(pencil, -0.02, -0.28, 0.3, 0, 0, -1.05)), 0, 0, 0, 0, 0, 0.1);
}

// ---- Dress up: a top hat with a satin band, a gold buckle and a feather
function topHat(): O {
  const felt = M(0x2a2428, { rough: 0.62, tex: 'felt' });
  const crown = lathe(smoothProfile([[0.47, -0.3], [0.46, 0.0], [0.48, 0.36], [0.52, 0.6], [0.51, 0.64], [0.4, 0.67], [0, 0.68]], 3), felt, 56);
  const brim = lathe(smoothProfile([[0.46, -0.34], [0.7, -0.345], [0.96, -0.33], [1.01, -0.3], [1.0, -0.26], [0.92, -0.28], [0.7, -0.3], [0.46, -0.27]], 3), felt, 64);
  const bp = brim.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i); bp.setXYZ(i, x, bp.getY(i) + 0.2 * Math.max(0, Math.abs(x) - 0.45) ** 2 / 0.3, z * 0.82); }
  brim.geometry.computeVertexNormals();
  const band = lathe([[0.478, -0.29], [0.482, -0.06], [0.47, -0.06], [0.466, -0.29]], M(0x6e1c26, { rough: 0.4, tex: 'weave' }), 56);
  const buckle = shape(rrectPts(0.22, 0.2, 0.03)); buckle.holes.push(new THREE.Path(rrectPts(0.12, 0.1, 0.02).map(([x, y]) => V2c(x, y))));
  const bk = at(ext(buckle, 0.03, C.gold(), 0.015, 2), 0, -0.175, 0.49);
  const plume = M(0x9a6a3a, { rough: 0.7, tex: 'leaf' }), tip = M(0x3a2a20, { rough: 0.7, tex: 'plain' });
  const feather = at(grp(leafMesh(0.5, 0.13, plume, 0), at(leafMesh(0.12, 0.05, tip, 0), 0, 0.44, 0.02), at(cyl(0.012, 0.016, 1.0, C.cream(), 6), 0, -0.02, 0.03)), 0.38, 0.22, 0.28, -0.25, 0.5, -0.55);
  return at(grp(crown, brim, band, bk, feather), 0, 0, 0, 0, 0, 0.12);
}

// ---- Map: a globe on a brass stand
let earthP: Promise<THREE.Texture> | null = null;
/** the Earth (from the game's NASA day map) painted as a globe-maker would: blue seas with lighter shallows, green
 * lowlands, ochre deserts, white ice */
function earthTex(): Promise<THREE.Texture> {
  earthP ??= new Promise((res) => {
    const im = new Image();
    const make = () => {
      const W = 512, H = 256, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d', { willReadFrequently: true })!;
      g.imageSmoothingQuality = 'high';
      if (im.width) g.drawImage(im, 0, 0, W, H); else { g.fillStyle = '#103060'; g.fillRect(0, 0, W, H); }
      const src = g.getImageData(0, 0, W, H).data, land = new Uint8Array(W * H), kind = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const r = src[i * 4], gg = src[i * 4 + 1], b = src[i * 4 + 2], lum = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        const y = Math.floor(i / W);
        if (lum > 0.62 || y < 4 || y > H - 8) { land[i] = 1; kind[i] = 3; continue; } // ice
        if ((r + gg) / 2 < b * 0.92 && lum < 0.5) continue; // sea
        land[i] = 1;
        kind[i] = r > gg * 1.06 && lum > 0.3 ? 2 : lum < 0.2 ? 0 : 1; // desert, forest, grassland
      }
      const out = g.createImageData(W, H);
      const SEA = hex('#2a6cc2'), SHALLOW = hex('#4c98de'), LAND = [hex('#3a8a3c'), hex('#58a844'), hex('#d4ac62'), hex('#f2f6fa')];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let c: RGB;
        if (land[i]) c = LAND[kind[i]];
        else {
          let near = false;
          for (let dy = -4; dy <= 4 && !near; dy += 2) for (let dx = -4; dx <= 4; dx += 2) if (land[Math.min(H - 1, Math.max(0, y + dy)) * W + ((x + dx + W) % W)]) { near = true; break; }
          c = near ? SHALLOW : SEA;
        }
        out.data.set([c[0], c[1], c[2], 255], i * 4);
      }
      g.putImageData(out, 0, 0);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      res(t);
    };
    im.onload = make; im.onerror = make;
    im.src = '/models/globe/earth_day.webp';
  });
  return earthP;
}
async function globe(): Promise<O> {
  const ball = mesh(new THREE.SphereGeometry(0.62, 64, 40), faceMat(await earthTex(), { rough: 0.32, pix: { glossy: true } }));
  ball.rotation.y = -1.75; // Africa and Europe in front, the Atlantic and a little of the Americas to the left
  const brass = C.brass();
  const ring = torus(0.7, 0.04, brass, Math.PI * 2, 10, 72);
  const pins = [1, -1].map((s) => at(lathe(smoothProfile([[0, 0], [0.05, 0.01], [0.04, 0.06], [0, 0.08]], 2), brass, 12), 0, s * 0.66, 0, s > 0 ? 0 : Math.PI, 0, 0));
  const tilted = at(grp(ball, ...pins), 0, 0, 0, 0, 0, -0.41);
  const stem = at(lathe(smoothProfile([[0.035, 0.0], [0.05, -0.06], [0.085, -0.12], [0.05, -0.18], [0.04, -0.24], [0.07, -0.3]], 3), brass, 20), 0, -0.72, 0);
  const base = at(lathe(smoothProfile([[0, 0.06], [0.2, 0.06], [0.34, 0.03], [0.42, -0.04], [0.43, -0.09], [0, -0.09]], 3), C.dark(), 40), 0, -1.08, 0);
  const trim = at(torus(0.41, 0.022, C.gold(), Math.PI * 2, 8, 48), 0, -1.12, 0, Math.PI / 2);
  return grp(tilted, ring, stem, base, trim);
}

// ---- the door: a round hobbit door of green-painted planks in a ring of stones, iron strap hinges, a brass knocker
function roundDoor(open: boolean): O {
  const R = 0.72, g = grp();
  const stones = [M(0x8e806c, { tex: 'stone', rough: 0.85 }), M(0x72685c, { tex: 'stone', rough: 0.85 }), M(0xa29278, { tex: 'stone', rough: 0.85 })], moss = M(0x4e9234, { tex: 'foliage', rough: 0.8 });
  const n = 13;
  const mortar = shape(arcPts(0, 0, 1.03, 0, Math.PI * 2, 48)); mortar.holes.push(new THREE.Path(arcPts(0, 0, 0.79, 0, -Math.PI * 2, 48).map(([x, y]) => V2c(x, y))));
  g.add(at(ext(mortar, 0.1, M(0x2e2420, { rough: 0.95, tex: 'plain' }), 0.01, 1), 0, 0, -0.08)); // the mortar behind
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + ((i + 0.1) / n) * Math.PI * 2, a1 = -Math.PI / 2 + ((i + 0.9) / n) * Math.PI * 2, ro = 1.0 + (h2(i, 3, 7) - 0.5) * 0.08;
    const pts: P2[] = [...arcPts(0, 0, 0.82, a0, a1, 6), ...arcPts(0, 0, ro, a1, a0, 6)];
    g.add(at(ext(shape(pts), 0.24, stones[(i * 2 + (i % 3)) % 3], 0.02, 2), 0, 0, -0.02));
  }
  // moss on the top stones, a step at the foot
  g.add(at(ext(shape([...arcPts(0, 0, 1.03, 1.2, 2.3, 10), ...arcPts(0, 0, 0.92, 2.3, 1.2, 10)]), 0.06, moss, 0.03, 2), 0, 0, 0.13));
  g.add(at(ext(shape(rrectPts(1.56, 0.16, 0.04)), 0.5, stones[1], 0.03, 2), 0, -0.98, 0.08));
  // the doorway behind: dark, or warm lamplight when the door stands open
  const inner = open
    ? Object.assign(new THREE.MeshBasicMaterial({ map: drawTex('warm', 128, 128, (g) => { const gr = g.createRadialGradient(64, 54, 4, 64, 60, 76); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.35, '#ffcc5a'); gr.addColorStop(0.7, '#f4922c'); gr.addColorStop(1, '#c8561a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }), toneMapped: false }), { userData: { pix: { glow: true } } })
    : M(0x2a1a14, { rough: 0.9, tex: 'plain' });
  g.add(at(mesh(planarUV(new THREE.CircleGeometry(0.82, 48)), inner), 0, 0, -0.06));
  // the door: five planks cut to the circle, two strap hinges, the knocker, a knob
  const door = grp(), pw = (2 * R) / 5;
  const greens = [M(0x2c7a3e, { tex: 'grain', rough: 0.5 }), M(0x358646, { tex: 'grain', rough: 0.5 })];
  door.add(at(mesh(planarUV(new THREE.CircleGeometry(R - 0.01, 48)), M(0x1c3a22, { rough: 0.9, tex: 'plain' })), R, 0, -0.035)); // dark between the planks
  for (let k = 0; k < 5; k++) {
    const x0 = -R + k * pw + 0.02, x1 = -R + (k + 1) * pw - 0.02, pts: P2[] = [];
    for (let j = 0; j <= 8; j++) { const x = x0 + ((x1 - x0) * j) / 8; pts.push([x, -Math.sqrt(Math.max(0, R * R - x * x))]); }
    for (let j = 8; j >= 0; j--) { const x = x0 + ((x1 - x0) * j) / 8; pts.push([x, Math.sqrt(Math.max(0, R * R - x * x))]); }
    door.add(at(ext(shape(pts), 0.08, greens[k % 2], 0.02, 2), R, 0, 0));
  }
  const iron = M(0x34343e, { metal: 0.6, rough: 0.45, tex: null });
  for (const y of [0.36, -0.36]) {
    const len = 1.0, strap: P2[] = [[0, -0.05], [len - 0.1, -0.05], [len, 0], [len - 0.1, 0.05], [0, 0.05]];
    door.add(at(ext(shape(strap), 0.025, iron, 0.012, 1), 0.02, y, 0.06));
    for (let k = 0; k < 4; k++) door.add(at(ball(0.022, iron, 8, 6), 0.12 + k * 0.24, y, 0.085));
    door.add(at(cyl(0.045, 0.045, 0.2, iron, 10), 0, y, 0.03));
  }
  const brass = M(0xe0a848, { metal: 0.65, rough: 0.28, tex: null, env: 1.15 });
  door.add(at(lathe(smoothProfile([[0, 0.04], [0.09, 0.03], [0.1, 0], [0, 0]], 2), brass, 24), R, 0.12, 0.05, Math.PI / 2));
  door.add(at(torus(0.13, 0.026, brass, Math.PI * 2, 8, 32), R, -0.02, 0.1));
  door.add(at(ball(0.055, brass, 14, 10), R + 0.46, -0.04, 0.08));
  // hinged at its left edge; ajar, it swings out towards us
  door.position.set(-R, 0, 0);
  if (open) door.rotation.y = -0.85;
  g.add(door);
  // flowers by the step
  for (const [x, c] of [[0.62, 0xf0c040], [0.76, 0xe0607a], [-0.7, 0xf4f0e8]] as [number, number][]) g.add(at(grp(at(cyl(0.012, 0.012, 0.16, M(0x4a8a3a, { tex: null }), 5), 0, -0.82, 0.3), at(ball(0.05, M(c, { rough: 0.5, tex: 'plain' }), 8, 6), 0, -0.73, 0.3)), x, 0, 0));
  return g;
}

// ---- Quests: a checklist scroll with a wax seal and a quill
function questScroll(): O {
  const list = drawTex('quest', 200, 244, (g) => {
    g.fillStyle = '#f7e8cc'; g.fillRect(0, 0, 200, 244);
    grain(g, 200, 244, 0.07);
    g.strokeStyle = '#b8402e'; g.lineWidth = 9; g.beginPath(); g.moveTo(44, 26); g.lineTo(156, 26); g.stroke();
    for (const [i, done] of [[0, 1], [1, 1], [2, 0]] as [number, number][]) {
      const y = 70 + i * 52;
      g.strokeStyle = '#5a4652'; g.lineWidth = 4; g.strokeRect(22, y, 28, 28);
      if (done) { g.strokeStyle = '#2f8a42'; g.lineWidth = 7; g.beginPath(); g.moveTo(26, y + 14); g.lineTo(35, y + 24); g.lineTo(56, y - 6); g.stroke(); }
      g.strokeStyle = '#5a4652'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(66, y + 8); g.lineTo(172 - i * 18, y + 8); g.stroke();
      g.strokeStyle = 'rgba(90,70,82,0.55)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(66, y + 21); g.lineTo(142 + i * 8, y + 21); g.stroke();
    }
  });
  const sheetG = new THREE.PlaneGeometry(1.0, 1.22, 8, 10);
  const p = sheetG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(((p.getX(i) + 0.5) / 1.0) * Math.PI) * 0.05);
  sheetG.computeVertexNormals();
  const sheet = mesh(sheetG, faceMat(list, { rough: 0.85, side: THREE.DoubleSide, pix: { flat: true } }));
  const roll = (y: number) => grp(at(lathe(smoothProfile([[0.12, -0.56], [0.13, 0], [0.12, 0.56]], 2), M(0xf2dcb2, { tex: 'paper', rough: 0.8 }), 20), 0, y, 0.06, 0, 0, Math.PI / 2),
    ...[-1, 1].map((s) => at(lathe(smoothProfile([[0, 0], [0.06, 0.02], [0.08, 0.08], [0.05, 0.13], [0, 0.15]], 2), C.dark(), 12), s * 0.57, y, 0.06, 0, 0, -s * Math.PI / 2)));
  const wax = M(0xc02c34, { rough: 0.3, tex: 'plain' }), rib = M(0x2f5aa0, { rough: 0.4, tex: 'weave' });
  const sealPts: P2[] = Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2, r = 0.17 + Math.sin(a * 7) * 0.012 + (h2(i, 2, 9) - 0.5) * 0.02; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const seal = grp(...[-1, 1].map((s) => at(ext(shape([[0, 0], [s * 0.1, -0.34], [s * 0.05, -0.3], [s * 0.02, -0.36], [s * -0.05, -0.02]]), 0.02, rib, 0.01, 1), s * 0.03, -0.02, -0.02)),
    ext(shape(sealPts), 0.06, wax, 0.035, 2), at(goldStar(0.08, 0.035, 5, M(0xe84850, { rough: 0.3, tex: 'plain' })), 0, 0, 0.05));
  const vane: P2[] = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2, y = Math.cos(t); vane.push([Math.sin(t) * 0.14 * (1 + 0.25 * y) * (Math.sin(t * 9) > 0.8 ? 0.85 : 1), y * 0.42 + 0.1]); }
  const quill = at(grp(ext(shape(vane), 0.03, M(0xeee8dc, { rough: 0.7, tex: 'plain' }), 0.02, 2), at(cyl(0.014, 0.022, 1.0, M(0xf0e4c4, { tex: null }), 6), 0, -0.1, 0.03), at(lathe([[0.022, 0], [0.008, -0.08], [0, -0.1]], M(0x3a3040, { tex: null }), 8), 0, -0.6, 0.03)), 0.48, 0.12, 0.2, 0, 0, -0.62);
  return grp(quill, at(sheet, 0, -0.05, 0), roll(0.62), roll(-0.69), at(seal, 0.3, -0.4, 0.12));
}

// ---- the currency: a glossy acorn with a cup of real scales, on an oak leaf; a brilliant-cut moon gem
/** the nut's skin: chestnut with faint stripes along it and a dark point (lathe texture coordinates) */
function nutTex(): THREE.Texture {
  return paintTex('px9-nut', 64, 32, (x, y) => {
    const u = x / 64, v = y / 31, s = Math.sin(u * Math.PI * 2 * 14 + fbm(u * 9, v * 3, 4) * 4) * 0.5 + 0.5;
    const base: RGB = v < 0.1 ? hex('#5a3016') : v < 0.16 ? hex('#8a4a1e') : hex('#b0621e');
    const k = 0.9 + s * 0.14 + (fbm(u * 30, v * 6, 2) - 0.5) * 0.1;
    return [base[0] * k, base[1] * k, base[2] * k];
  });
}
/**
 * The acorn: a plump glossy nut with its little point, a cup of overlapping scales in rows (each a real little scale,
 * in two browns, set like roof tiles), a rolled rim, a short twig stalk.
 */
function acorn9(s = 1, tilt = 0, detail = true): THREE.Group {
  const nutM = new THREE.MeshStandardMaterial({ map: nutTex(), roughness: 0.13, envMapIntensity: 1.6 });
  nutM.userData.pix = { glossy: true, smooth: 0.15 };
  const nut = lathe(smoothProfile([[0, -0.86], [0.035, -0.84], [0.06, -0.78], [0.2, -0.68], [0.36, -0.46], [0.44, -0.16], [0.445, 0.06], [0.4, 0.16], [0, 0.18]], 4), nutM, 48);
  const cupBase = M(0x2a180c, { rough: 0.85, tex: 'plain' });
  const prof = smoothProfile([[0.0, 0.5], [0.16, 0.48], [0.36, 0.39], [0.5, 0.23], [0.54, 0.08], [0.5, 0.02]], 6);
  const cup = lathe([...prof, [0.42, 0.04], [0, 0.08]], cupBase, 48);
  const g = grp(nut, cup);
  if (detail) {
    const sA = M(0x8a5e34, { rough: 0.75, tex: 'plain' }), sB = M(0x6a4222, { rough: 0.8, tex: 'plain' }), sC = M(0xa87842, { rough: 0.7, tex: 'plain' });
    const scaleG = new THREE.SphereGeometry(1, 10, 7);
    // along the cup's outline from its crown to its rim
    const L: number[] = [0];
    for (let i = 1; i < prof.length; i++) L.push(L[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const atLen = (d: number): [number, number, number, number] => {
      let i = 1; while (i < prof.length - 1 && L[i] < d) i++;
      const t = (d - L[i - 1]) / (L[i] - L[i - 1] || 1), r = prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t, y = prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * t;
      const dr = prof[i][0] - prof[i - 1][0], dy = prof[i][1] - prof[i - 1][1], l = Math.hypot(dr, dy) || 1;
      return [r, y, dr / l, dy / l];
    };
    const rows = 5, total = L[L.length - 1];
    for (let j = 0; j < rows; j++) {
      const [r, y, dr, dy] = atLen(total * (0.17 + (j / (rows - 1)) * 0.74));
      const count = Math.max(5, Math.round((Math.PI * 2 * r) / 0.15));
      for (let k = 0; k < count; k++) {
        const a = ((k + (j % 2) * 0.5) / count) * Math.PI * 2, e = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const T = e.clone().multiplyScalar(dr).add(new THREE.Vector3(0, dy, 0)).normalize(); // down the cup, towards the rim
        const Nn = e.clone().multiplyScalar(-dy).add(new THREE.Vector3(0, dr, 0)).normalize(); // out of the cup
        const X = new THREE.Vector3().crossVectors(T, Nn).normalize();
        const m = (j + k) % 3 === 0 ? sC : (j + k) % 2 ? sA : sB;
        const sc = mesh(scaleG, m);
        sc.matrixAutoUpdate = false;
        const basis = new THREE.Matrix4().makeBasis(X.multiplyScalar(0.078), T.multiplyScalar(0.088), Nn.clone().multiplyScalar(0.03));
        basis.setPosition(e.clone().multiplyScalar(r).add(new THREE.Vector3(0, y, 0)).addScaledVector(Nn, 0.01));
        sc.matrix.copy(basis);
        g.add(sc);
      }
    }
  }
  g.add(at(torus(0.505, 0.045, M(0x7a5232, { rough: 0.75, tex: 'plain' }), Math.PI * 2, 8, 48), 0, 0.045, 0, Math.PI / 2));
  g.add(tube([[0, 0.48, 0], [0.03, 0.62, 0], [0.1, 0.72, 0.02]], 0.045, M(0x5a3e28, { rough: 0.8, tex: 'bark' }), 8, 6));
  return grp(at(g, 0, 0, 0, 0, 0, tilt, s));
}
/** the currency acorn: the detailed acorn, leaning a little, on an oak leaf */
function bigAcorn9(): THREE.Group {
  const leaf = at(oakLeaf(1.0, M(0x5e9e36, { rough: 0.55, tex: 'leaf', pix: {} })), 0.12, 0.2, -0.4, 0, 0.3, -1.05);
  return grp(acorn9(1, -0.12), leaf);
}
/**
 * The moon gem: a brilliant cut (an octagonal table, star and upper-girdle facets, a girdle, lower-girdle and pavilion
 * facets down to the culet), every facet flat; the facets are cut from violets, lilac and pink in a pattern like the
 * light thrown about inside a real stone, the inner facets glowing a little (`withMoon`: a golden crescent on the table).
 */
function moonGem9(withMoon = false): O {
  const pal = [0x2c1264, 0x5a2ab4, 0x8a52e0, 0xb88cf4, 0xe8a8f4, 0xf6ecff];
  const mats = pal.map((c, i) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.1, metalness: 0.25, flatShading: true, envMapIntensity: 1.4, emissive: c, emissiveIntensity: [0.1, 0.16, 0.2, 0.24, 0.32, 0.3][i] }); m.userData.pix = { steps: 2, smooth: 0, glossy: i >= 3, flat: true }; return m; });
  const N = 8, rot = Math.PI / 8, P: number[] = [], groups: [number, number][] = [];
  const v = (r: number, y: number, a: number) => [Math.cos(a) * r, y, Math.sin(a) * r];
  const tri = (a: number[], b: number[], c: number[], m: number) => { groups.push([P.length / 3, m]); P.push(...a, ...c, ...b); };
  const T = (i: number) => v(0.4, 0.42, (i / N) * Math.PI * 2 + rot), G = (j: number) => v(0.76, 0.06, (j / (N * 2)) * Math.PI * 2 + rot), G2 = (j: number) => v(0.76, -0.04, (j / (N * 2)) * Math.PI * 2 + rot);
  const Pv = (i: number) => v(0.36, -0.46, (i / N) * Math.PI * 2 + rot), Q = (i: number) => v(0.15, -0.76, ((i + 0.5) / N) * Math.PI * 2 + rot), cul = [0, -1.0, 0], top = [0, 0.42, 0];
  for (let i = 0; i < N; i++) {
    tri(top, T(i), T(i + 1), 5); // the table
    tri(T(i), G(2 * i + 1), T(i + 1), i % 2 ? 3 : 2); // star facets
    tri(T(i), G(2 * i), G(2 * i + 1), i % 2 ? 1 : 3); // upper girdle facets
    tri(T(i + 1), G(2 * i + 1), G(2 * i + 2), i % 2 ? 4 : 1);
    for (const j of [2 * i, 2 * i + 1]) { tri(G(j), G2(j), G2(j + 1), 1); tri(G(j), G2(j + 1), G(j + 1), 1); } // the girdle
    tri(G2(2 * i), Pv(i), G2(2 * i + 1), i % 2 ? 2 : 0); // lower girdle facets
    tri(G2(2 * i + 1), Pv(i + 1), G2(2 * i + 2), i % 2 ? 0 : 2);
    tri(G2(2 * i + 1), Pv(i), Pv(i + 1), i % 2 ? 3 : 1);
    // the pavilion's mains, split: an upper band and a lower star round the culet, lit from within
    tri(Pv(i), Q(i), Pv(i + 1), [3, 1, 4, 2][i % 4]);
    tri(Pv(i), Q(i - 1), Q(i), [0, 2, 1, 3][i % 4]);
    tri(Q(i), cul, Q(i + 1), [4, 5, 2, 4][i % 4]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  for (const [start, m] of groups) geo.addGroup(start, 3, m);
  geo.computeVertexNormals();
  const gem = new THREE.Mesh(geo, mats);
  gem.castShadow = true; gem.receiveShadow = true;
  const g = grp(gem);
  if (withMoon) g.add(at(ext(shape(crescentPts(0.17, 0.15, [0.07, 0.05], 48)), 0.02, M(0xffe08a, { glow: 0.9, rough: 0.3, tex: null, pix: { glow: true } }), 0.01, 1), -0.02, 0.43, 0.02, -Math.PI / 2, 0, 0));
  return g;
}

// ------------------------------------------------------------------ [icons10] the family, polished
// The symbols are cloisonné, like an enamel pin or a clockmaker's badge: a domed, glassy vitreous enamel in a natural
// pigment, edged with a fine polished brass wire and set on a bevelled brass backing a little bigger than it. The
// medallions are the same enamel in a turned brass bezel with an ivory glyph. Brass is polished (a warm gleam, dark
// bands from the studio) and chrome is bright; everything else is a real object made of real parts.
const physCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** vitreous enamel: a saturated pigment under a glassy clear coat */
function vitreous(c: number, rough = 0.36): THREE.MeshPhysicalMaterial {
  const k = c + ':' + rough;
  let m = physCache.get(k);
  if (!m) {
    // a faint mottle in the glass (no crazing, no chips)
    const map = enamel('#' + c.toString(16).padStart(6, '0'), { craze: 0, chips: false }).map;
    m = new THREE.MeshPhysicalMaterial({ map, roughness: rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 0.9 });
    physCache.set(k, m); ownMats.add(m);
  }
  return m;
}
/** [icons10] gilt: bright burnished gold that keeps its warm colour in the facets' shadows (stars, the sun, the moon's crescent) */
function gilt(c = 0xf2c04a): THREE.MeshPhysicalMaterial {
  const k = 'gilt' + c;
  let m = physCache.get(k);
  if (!m) { m = new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.62, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.15, envMapIntensity: 1.25 }); physCache.set(k, m); ownMats.add(m); }
  return m;
}
/** polished brass (the bezels, wires, bells and stands) */
const BRASS = () => M(0xe9b24e, { metal: 0.92, rough: 0.24, tex: null, env: 1.15 });
/** darker, older brass for the backs of things */
const OLDBRASS = () => M(0xb88436, { metal: 0.9, rough: 0.34, tex: null, env: 1.0 });
/** bright chrome */
const CHROME = () => M(0xe6eaf0, { metal: 0.95, rough: 0.16, tex: null, env: 1.35 });
/** blackened steel (clock hands, screws) */
const BLACKSTEEL = () => M(0x2a2630, { metal: 0.7, rough: 0.35, tex: null, env: 0.8 });
/** a domed slab of `pts` (a pillow of enamel): widest at z 0..0.01, its top rounded `h` above */
function dome(pts: P2[], m: THREE.Material, h = 0.07, b = 0.045, seg = 5): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape(offsetPts(pts, -b)), { depth: 0.01, bevelEnabled: true, bevelThickness: h, bevelSize: b, bevelSegments: seg, curveSegments: 48 });
  g.computeVertexNormals();
  return mesh(g, m);
}
/** a polished wire laid along a closed outline */
const wireAlong = (pts: P2[], r: number, m: THREE.Material, z: number) => tube(pts.map(([x, y]) => [x, y, z] as [number, number, number]), r, m, Math.max(64, pts.length * 3), 6, true);
/** a cloisonné shape: domed enamel in a brass wire on a bevelled brass backing */
function cloison(pts: P2[], enamelM: THREE.Material, o: { rim?: number; wire?: number; h?: number; z?: number; back?: THREE.Material } = {}): THREE.Group {
  const rim = o.rim ?? 0.065, wire = o.wire ?? 0.028, h = o.h ?? 0.075;
  const g = grp(
    ext(shape(offsetPts(pts, rim)), 0.06, o.back ?? OLDBRASS(), 0.028, 3, 48),
    at(dome(pts, enamelM, h, 0.05), 0, 0, 0.03),
    wireAlong(pts, wire, BRASS(), 0.062),
  );
  g.position.z = o.z ?? 0;
  return g;
}
/** a stroke (a polyline of width w) in cloisonné */
const cloisonStroke = (pts: P2[], w: number, m: THREE.Material, o: Parameters<typeof cloison>[2] = {}) => cloison(strokePts(pts, w, 10), m, o);
/** an enamel medallion in a turned brass bezel with raised ivory glyphs, each in its own wire */
function medal(color: number, glyphs: P2[][]): THREE.Group {
  const g = grp(
    at(lathe(smoothProfile([[0, -0.08], [0.8, -0.08], [0.88, -0.05], [0.9, 0.02], [0.86, 0.08], [0.8, 0.09], [0.77, 0.05]], 3), BRASS(), 96), 0, 0, 0, Math.PI / 2),
    at(dome(circlePts(0.78, 96), vitreous(color), 0.05, 0.04), 0, 0, 0.0),
  );
  for (const p of glyphs) g.add(at(dome(p, vitreous(0xf3e8cf, 0.4), 0.05, 0.035), 0, 0, 0.07), wireAlong(p, 0.022, BRASS(), 0.09));
  return g;
}

/** clear glass (jars, tubes, crystals): `a` opaque */
const clearGlass = (a = 0.22) => M(0xeef8ff, { rough: 0.04, metal: 0.1, tex: null, env: 1.7, opacity: a, side: THREE.DoubleSide });
/** a capsule from a to b (a finger, a rod with round ends) */
function capsule(a: [number, number, number], b: [number, number, number], r: number, m: THREE.Material): THREE.Mesh {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const me = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, d.length()), 8, 20), m);
  me.position.copy(A).add(B).multiplyScalar(0.5);
  me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return me;
}
/** a rod (cylinder) from a to b */
function rod(a: [number, number, number], b: [number, number, number], r: number, m: THREE.Material, seg = 12): THREE.Mesh {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const me = mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), m);
  me.position.copy(A).add(B).multiplyScalar(0.5);
  me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return me;
}

// ---- alarm: a brass twin-bell alarm clock (two bells and the hammer between them, a cream dial, splayed feet)
function alarmDialTex(): THREE.Texture {
  return drawTex('alarmdial', 256, 256, (g) => {
    const c = 128;
    const rg = g.createRadialGradient(c - 30, c - 40, 10, c, c, 128);
    rg.addColorStop(0, '#fbf3de'); rg.addColorStop(0.8, '#f1e2bf'); rg.addColorStop(1, '#dcc59a');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    grain(g, 256, 256, 0.04);
    g.strokeStyle = '#3a2c2a';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, big = i % 5 === 0, r0 = big ? 96 : 104, r1 = 113;
      g.lineWidth = big ? 6 : 2.2;
      g.beginPath(); g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); g.lineTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); g.stroke();
    }
    g.fillStyle = '#3a2c2a'; g.font = 'bold 40px Georgia, "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [t, a] of [['12', 0], ['3', 3], ['6', 6], ['9', 9]] as [string, number][]) { const an = (a / 12) * Math.PI * 2; g.fillText(t, c + Math.sin(an) * 72, c - Math.cos(an) * 72 + 2); }
    g.strokeStyle = 'rgba(150,110,60,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, 118, 0, 7); g.stroke();
  });
}
function alarmClock(): O {
  const brass = BRASS(), dark = OLDBRASS(), steel = BLACKSTEEL();
  // the drum: a turned case, its axis towards the viewer
  const caseP = smoothProfile([[0, -0.24], [0.46, -0.24], [0.58, -0.2], [0.63, -0.12], [0.64, 0.1], [0.62, 0.15], [0.66, 0.17], [0.68, 0.22], [0.65, 0.27], [0.59, 0.27], [0.57, 0.22]], 3);
  const drum = at(lathe(caseP, brass, 96), 0, 0, 0, Math.PI / 2);
  const dial = at(mesh(new THREE.CircleGeometry(0.575, 96), faceMat(alarmDialTex(), { rough: 0.55 })), 0, 0, 0.2);
  const hand = (len: number, w: number, a: number, m: THREE.Material, z: number, spade = true) => {
    const pts: P2[] = spade
      ? [[-w / 2, -0.08], [w / 2, -0.08], [w * 0.35, len * 0.62], [w * 1.6, len * 0.72], [0, len], [-w * 1.6, len * 0.72], [-w * 0.35, len * 0.62]]
      : [[-w / 2, -0.12], [w / 2, -0.12], [w / 4, len * 0.86], [w * 1.4, len * 0.84], [0, len], [-w * 1.4, len * 0.84], [-w / 4, len * 0.86]];
    return at(ext(shape(pts), 0.012, m, 0.006, 1), 0, 0, z, 0, 0, -a);
  };
  const H = 10, Mi = 9; // ten past ten: the hands frame the dial
  const hands = grp(hand(0.3, 0.05, ((H + Mi / 60) / 12) * Math.PI * 2, steel, 0.215), hand(0.44, 0.04, (Mi / 60) * Math.PI * 2, steel, 0.228),
    hand(0.4, 0.018, (7 / 12) * Math.PI * 2, M(0xb0302a, { rough: 0.4, tex: 'plain' }), 0.205, false), at(cyl(0.035, 0.035, 0.03, brass, 16), 0, 0, 0.24, Math.PI / 2));
  // the crystal: a shallow dome of glass over the dial
  const crystal = at(lathe(smoothProfile([[0, 0.29], [0.3, 0.28], [0.5, 0.25], [0.58, 0.22]], 3), clearGlass(0.14), 64), 0, 0, 0, Math.PI / 2);
  // the bells: two polished domes on posts, tilted out, with a finial; the hammer between them
  const bellP = smoothProfile([[0, 0.3], [0.06, 0.3], [0.18, 0.26], [0.27, 0.17], [0.31, 0.06], [0.33, 0.0], [0.33, -0.02], [0.3, -0.02], [0.28, 0.05]], 4);
  const bell = (s: number) => {
    const b = grp(lathe(bellP, brass, 64), at(ball(0.05, brass, 16, 12), 0, 0.32, 0), at(cyl(0.035, 0.035, 0.3, dark, 12), 0, -0.1, 0));
    return at(b, s * 0.4, 0.66, -0.06, 0, 0, -s * 0.5);
  };
  const hammer = grp(rod([0, 0.5, -0.12], [0, 0.86, -0.12], 0.022, steel), at(capsule([-0.1, 0.88, -0.12], [0.1, 0.88, -0.12], 0.045, brass), 0, 0, 0));
  // the feet: splayed legs with ball feet
  const foot = (s: number) => grp(rod([s * 0.32, -0.5, -0.04], [s * 0.5, -0.8, -0.04], 0.045, brass), at(ball(0.07, brass, 16, 12), s * 0.51, -0.82, -0.04));
  // the winding keys at the back, peeking out
  const key = (x: number) => grp(at(ext(shape(roundPoly([[-0.12, 0], [0.12, 0], [0.08, 0.14], [-0.08, 0.14]], 0.03)), 0.03, dark, 0.012, 1), x, 0.0, -0.4), at(cyl(0.03, 0.03, 0.16, dark, 10), x, 0, -0.3, Math.PI / 2));
  return grp(drum, dial, hands, crystal, bell(-1), bell(1), hammer, foot(-1), foot(1), key(-0.25), key(0.25));
}

// ---- mic: a vintage broadcast microphone, a chrome capsule with its grille of rings on a brass yoke and stand
function micro(): O {
  const chrome = CHROME(), brass = BRASS(), core = M(0x2a2228, { rough: 0.8, tex: 'weave' });
  const prof: P2[] = smoothProfile([[0, -0.56], [0.12, -0.54], [0.24, -0.46], [0.32, -0.3], [0.35, -0.1], [0.35, 0.12], [0.32, 0.32], [0.24, 0.48], [0.12, 0.56], [0, 0.58]], 4);
  const rAt = (y: number) => { let best = prof[0]; for (const p of prof) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; return best[0]; };
  const head = grp(lathe(prof.map(([r, y]) => [r * 0.9, y * 0.94] as P2), core, 48));
  // the grille: chrome rings round the capsule, a top and a bottom cap, a spine down the front and the sides
  for (let i = 0; i < 9; i++) { const y = -0.36 + i * 0.09; head.add(at(torus(rAt(y) * 0.97, 0.016, chrome, Math.PI * 2, 6, 64), 0, y, 0, Math.PI / 2)); }
  head.add(lathe(prof.filter(([, y]) => y > 0.4), chrome, 48), lathe(prof.filter(([, y]) => y < -0.42), chrome, 48));
  for (const a of [Math.PI / 2, Math.PI / 2 + 1.25, Math.PI / 2 - 1.25]) head.add(tube(prof.filter(([, y]) => y > -0.5 && y < 0.52).map(([r, y]) => [Math.cos(a) * r * 0.99, y, Math.sin(a) * r * 0.99] as [number, number, number]), 0.022, chrome, 40, 6));
  head.add(at(torus(0.352, 0.03, brass, Math.PI * 2, 8, 64), 0, 0, 0, Math.PI / 2));
  // a little brass badge on the front
  head.add(at(ext(shape(rrectPts(0.16, 0.1, 0.03)), 0.015, brass, 0.008, 1), 0, -0.2, 0.33));
  // the yoke holds it at its sides, on knurled knobs
  const yoke = grp(at(torus(0.44, 0.035, brass, Math.PI, 10, 40), 0, -0.02, 0, 0, 0, Math.PI),
    ...[-1, 1].map((s) => grp(at(cyl(0.06, 0.06, 0.14, brass, 20), s * 0.4, -0.02, 0, 0, 0, Math.PI / 2), at(cyl(0.075, 0.075, 0.04, chrome, 20), s * 0.48, -0.02, 0, 0, 0, Math.PI / 2))));
  const stem = grp(rod([0, -0.46, 0], [0, -0.96, 0], 0.04, chrome), at(lathe(smoothProfile([[0.04, 0], [0.075, 0.02], [0.075, 0.08], [0.04, 0.1]], 2), brass, 20), 0, -0.62, 0));
  const base = at(lathe(smoothProfile([[0, 0.1], [0.12, 0.1], [0.3, 0.07], [0.44, 0.03], [0.48, 0], [0.46, -0.03], [0, -0.03]], 3), M(0x2c2430, { rough: 0.3, tex: 'plain' }), 64), 0, -1.06, 0);
  const baseRim = at(torus(0.47, 0.022, chrome, Math.PI * 2, 8, 64), 0, -1.07, 0, Math.PI / 2);
  return grp(at(head, 0, 0.12, 0), yoke, stem, base, baseRim);
}

// ---- jar: a glass firefly jar with a cork, twine round its neck, grass inside and warm motes of light
function corkTex(): THREE.Texture {
  return paintTex('cork', 64, 64, (x, y) => {
    const n = fbm(x * 0.2, y * 0.2, 3), p = h2(x, y, 5);
    const base: RGB = hex('#c4925a');
    const k = 0.85 + n * 0.3 - (p > 0.86 ? 0.35 : 0) + (p < 0.05 ? 0.15 : 0);
    return [base[0] * k, base[1] * k, base[2] * k];
  });
}
function fireflyJar(): O {
  const glassP = smoothProfile([[0, -0.8], [0.4, -0.8], [0.52, -0.76], [0.57, -0.64], [0.58, 0.26], [0.54, 0.4], [0.42, 0.5], [0.34, 0.54], [0.33, 0.6], [0.36, 0.64], [0.34, 0.68]], 3);
  const jar = lathe(glassP, clearGlass(0.2), 64);
  const corkM = new THREE.MeshStandardMaterial({ map: corkTex(), roughness: 0.9 });
  const cork = lathe(smoothProfile([[0, 0.54], [0.27, 0.54], [0.3, 0.6], [0.32, 0.8], [0.3, 0.84], [0, 0.85]], 2), corkM, 40);
  const twine = M(0xc8a46c, { rough: 0.9, tex: 'burlap' });
  const neck = grp(at(torus(0.355, 0.024, twine, Math.PI * 2, 6, 48), 0, 0.59, 0, Math.PI / 2), at(torus(0.352, 0.024, twine, Math.PI * 2, 6, 48), 0, 0.635, 0, Math.PI / 2),
    tube([[0.3, 0.6, 0.2], [0.4, 0.5, 0.26], [0.44, 0.32, 0.3], [0.42, 0.2, 0.3]], 0.02, twine, 16, 6), tube([[0.32, 0.6, 0.18], [0.46, 0.56, 0.18], [0.54, 0.44, 0.16]], 0.02, twine, 12, 6));
  // moss and grass at the bottom, a twig
  const moss = at(lathe(smoothProfile([[0, -0.62], [0.3, -0.64], [0.5, -0.7], [0.54, -0.77], [0, -0.77]], 2), M(0x4a6a2c, { rough: 0.95, tex: 'foliage' }), 40), 0, 0, 0);
  const blade = M(0x5e8a34, { rough: 0.6, tex: 'leaf', side: THREE.DoubleSide });
  const grass = grp(...[[-0.3, 0.1, 0.5, 0.2], [-0.12, -0.1, 0.62, -0.1], [0.18, 0.05, 0.4, 0.25], [0.3, -0.15, 0.55, -0.3], [0.02, 0.2, 0.3, 0.05]].map(([x, z, h, lean]) => {
    const pts: P2[] = [[-0.035, 0], [0.035, 0], [0.01 + lean * 0.2, h * 0.7], [lean * 0.4, h]];
    return at(mesh(new THREE.ShapeGeometry(shape(pts)), blade), x, -0.66, z, 0, x * 2, 0);
  }), tube([[-0.4, -0.6, -0.1], [-0.1, -0.4, 0.05], [0.25, -0.15, -0.05], [0.36, -0.02, -0.12]], 0.025, M(0x6a4428, { rough: 0.9, tex: 'bark' }), 16, 6));
  // the fireflies: a hot core, a soft halo; and a warm light filling the jar
  const core = new THREE.MeshBasicMaterial({ color: 0xfffbe0 });
  const halo = new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, opacity: 0.38, depthWrite: false });
  const halo2 = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.16, depthWrite: false });
  const motes = grp();
  for (const [x, y, z, s] of [[-0.18, 0.12, 0.2, 1], [0.2, -0.18, 0.18, 0.9], [0.06, 0.34, 0.1, 0.75], [-0.26, -0.3, 0.12, 0.8], [0.26, 0.18, -0.05, 0.7], [-0.04, -0.06, 0.32, 0.65]]) {
    motes.add(at(ball(0.035 * s, core, 12, 8), x, y, z), at(ball(0.09 * s, halo, 16, 12), x, y, z), at(ball(0.17 * s, halo2, 16, 12), x, y, z));
  }
  const glow = lathe(glassP.filter(([, y]) => y < 0.4).map(([r, y]) => [r * 0.92, y] as P2), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.12, depthWrite: false }), 48);
  return grp(moss, grass, glow, motes, jar, cork, neck);
}

// ---- nest: a woven nest of twigs and dry grass with a little blue egg
function eggTex(): THREE.Texture {
  return paintTex('robinegg', 64, 64, (x, y) => {
    const n = fbm(x * 0.15, y * 0.15, 3), p = h2(x, y, 3);
    const c: RGB = hex('#8ccfd6'), k = 0.94 + n * 0.12;
    if (p > 0.965) return hex('#6a5a4a');
    return [c[0] * k, c[1] * k, c[2] * k];
  });
}
function twigNest(): O {
  const twigs = [M(0x8a5a32, { rough: 0.9, tex: 'bark' }), M(0xa8743c, { rough: 0.9, tex: 'bark' }), M(0x6a4426, { rough: 0.9, tex: 'bark' }), M(0xc8a060, { rough: 0.85, tex: 'grain' })];
  const g = grp();
  // the bowl: layer on layer of twigs wound round, wider as they rise, with loose ends
  const N = 84;
  for (let i = 0; i < N; i++) {
    const t = (i % 14) / 13, a0 = h2(i, 1, 3) * Math.PI * 2, span = 1.1 + h2(i, 2, 3) * 1.3;
    const y0 = -0.34 + t * 0.44, R0 = 0.4 + 0.36 * Math.sqrt(t), wob = 0.05;
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (span * k) / 6, r = R0 + (h2(i, k, 7) - 0.5) * wob * 2 + (k === 0 || k === 6 ? (h2(i, k, 9) - 0.3) * 0.18 : 0);
      pts.push([Math.cos(a) * r, y0 + (h2(i, k, 11) - 0.5) * 0.08 + Math.sin(k * 0.9 + i) * 0.03, Math.sin(a) * r * 0.92]);
    }
    g.add(tube(pts, 0.016 + h2(i, 3, 3) * 0.016, twigs[i % 4], 24, 5));
  }
  // a few sticking out past the rim
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3, r = 0.72;
    g.add(tube([[Math.cos(a) * r * 0.8, 0.0, Math.sin(a) * r * 0.8], [Math.cos(a + 0.25) * r * 1.12, 0.06 + (i % 2) * 0.05, Math.sin(a + 0.25) * r * 1.12], [Math.cos(a + 0.38) * r * 1.3, 0.1 + (i % 3) * 0.04, Math.sin(a + 0.38) * r * 1.3]], 0.014, twigs[(i + 1) % 3], 10, 5));
  }
  // the soft lining of dry grass inside, and the floor of the bowl
  g.add(lathe(smoothProfile([[0, -0.2], [0.24, -0.19], [0.44, -0.12], [0.58, 0.02], [0.62, 0.06]], 3), M(0xb89058, { rough: 0.95, tex: 'burlap' }), 48));
  g.add(at(lathe(smoothProfile([[0, -0.4], [0.4, -0.38], [0.58, -0.3], [0.7, -0.14]], 3), M(0x7a5030, { rough: 0.95, tex: 'bark' }), 48), 0, 0, 0, 0, 0, 0, [1, 1, 0.92]));
  // the egg
  const egg = lathe(smoothProfile([[0, -0.27], [0.15, -0.24], [0.21, -0.12], [0.2, 0.04], [0.14, 0.2], [0, 0.3]], 4), new THREE.MeshStandardMaterial({ map: eggTex(), roughness: 0.32, envMapIntensity: 0.9 }), 40);
  g.add(at(egg, 0.04, -0.02, 0.02, 0.35, 0, -0.55));
  // a downy feather on the rim
  const down = M(0xf4efe6, { rough: 0.8, tex: 'plain' });
  g.add(at(grp(leafMesh(0.18, 0.09, down, 11), at(cyl(0.008, 0.008, 0.3, down, 5), 0, -0.1, 0.01)), -0.62, 0.12, 0.38, -0.6, 0.4, 0.9));
  return g;
}

// ---- wind: flowing ribbons of air curling at their ends, and a leaf riding them
/** a ribbon that tapers at both ends, its face turned to `face`, twisting a little along its length */
function airRibbon(pts: [number, number, number][], w: number, m: THREE.Material, twist = 0.5, seg = 96): THREE.Mesh {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const P: number[] = [], U: number[] = [], I: number[] = [], face = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = c.getPointAt(t), tg = c.getTangentAt(t);
    const side = new THREE.Vector3().crossVectors(face, tg).normalize().applyAxisAngle(tg, Math.sin(t * Math.PI) * twist * 0.5);
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.5) * (1 - t * 0.4) + 0.006;
    for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, s * hw); P.push(q.x, q.y, q.z); U.push(t, (s + 1) / 2); }
    if (i < seg) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return mesh(g, m, false);
}
/** a gust: a line drawn left to right that ends in a curl (spiral) of `turns` */
function gust(x0: number, x1: number, y: number, r: number, up: number, turns = 1.1): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x0 + (x1 - x0) * t, y + Math.sin(t * Math.PI * 1.2) * 0.05 * up, Math.sin(t * Math.PI) * 0.12]); }
  const cx = x1, cy = y + r * up;
  for (let i = 1; i <= 14; i++) { const t = i / 14, a = -Math.PI / 2 * up + t * Math.PI * 2 * turns * up, rr = r * (1 - t * 0.55); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.12 - t * 0.1]); }
  return pts;
}
function airTex(): THREE.Texture {
  return drawTex('airribbon', 256, 32, (g) => {
    const lg = g.createLinearGradient(0, 0, 256, 0);
    lg.addColorStop(0, '#9cc4e8'); lg.addColorStop(0.45, '#f0f8fe'); lg.addColorStop(1, '#8ab6e0');
    g.fillStyle = lg; g.fillRect(0, 0, 256, 32);
    g.strokeStyle = 'rgba(70,120,180,0.3)'; g.lineWidth = 1.5;
    for (const y of [9, 16, 23]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  });
}
function windGusts(): O {
  const m = new THREE.MeshStandardMaterial({ map: airTex(), roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.6, emissive: 0xffffff, emissiveMap: airTex(), emissiveIntensity: 0.14 });
  const g = grp(
    airRibbon(gust(-0.95, 0.36, 0.46, 0.22, 1), 0.26, m, 0.6),
    airRibbon(gust(-0.8, 0.58, -0.02, 0.26, -1, 1.0), 0.3, m, -0.5),
    airRibbon(gust(-0.98, 0.12, -0.52, 0.18, -1, 1.15), 0.2, m, 0.4),
  );
  const leaf = at(grp(oakLeaf(0.9, M(0xc8782a, { rough: 0.55, tex: 'leaf' })), at(cyl(0.016, 0.02, 0.2, M(0x6a4426, { tex: null }), 6), 0, -0.08, 0)), 0.5, 0.05, 0.3, 0.5, 0.4, -1.9);
  return grp(g, leaf);
}

// ---- zzz: three soft, plump letters drifting up, night blue fading to lavender
const ZPTS: P2[] = roundPoly([[-0.5, 0.5], [0.5, 0.5], [0.5, 0.27], [-0.08, -0.26], [0.5, -0.26], [0.5, -0.5], [-0.5, -0.5], [-0.5, -0.27], [0.08, 0.26], [-0.5, 0.26]], 0.1, 5);
function sleepyZ(): O {
  const z = (s: number, c: number) => grp(at(dome(ZPTS.map(([x, y]) => [x * s, y * s] as P2), M(c, { rough: 0.42, tex: 'plain', env: 0.9 }), 0.15 * s, 0.05 * s, 6), 0, 0, 0));
  return grp(at(z(1, 0x46549e), -0.46, -0.44, 0, 0, 0, 0.08), at(z(0.7, 0x6876c4), 0.26, 0.14, 0.05, 0, 0, 0.16), at(z(0.48, 0x9aa2de), 0.72, 0.62, 0.1, 0, 0, 0.24),
    at(goldStar(0.12, 0.05, 4), 0.28, 0.7, 0.1), at(goldStar(0.08, 0.034, 4), 0.85, 0.08, 0.1));
}

// ---- cursor_hand: a friendly cartoon glove pointing up, plump fingers, three stitches on its back, a rolled cuff
function cartoonGlove(): O {
  const glove = M(0xfbf6ec, { rough: 0.55, tex: 'plain', env: 0.7 }), stitch = M(0x8a7a76, { rough: 0.6, tex: null });
  const palm = at(dome(rrectPts(0.74, 0.66, 0.28, 8), glove, 0.17, 0.1, 6), 0.01, -0.2, 0);
  const index = capsule([-0.17, -0.06, 0.06], [-0.16, 0.42, 0.06], 0.15, glove);
  const knuckle = (x: number, y: number, r: number) => capsule([x, y, 0.12], [x + 0.02, y - 0.16, 0.2], r, glove);
  const thumb = capsule([-0.36, -0.28, 0.12], [-0.1, -0.06, 0.24], 0.11, glove);
  // a flared cuff with a rolled edge, closed underneath
  const cuff = at(grp(lathe(smoothProfile([[0.27, -0.44], [0.29, -0.52], [0.34, -0.6], [0.39, -0.67], [0.42, -0.72], [0.4, -0.77], [0.34, -0.78], [0, -0.78]], 4), glove, 48)), 0, 0, -0.02, -0.12, 0, 0, [1, 1, 0.78]);
  const st = (x: number) => tube([[x, 0.02, 0.17], [x, -0.14, 0.19], [x, -0.3, 0.17]], 0.012, stitch, 8, 5);
  return at(grp(palm, index, knuckle(0.06, 0.06, 0.12), knuckle(0.22, 0.02, 0.115), knuckle(0.35, -0.06, 0.105), thumb, cuff, st(0.02), st(0.15), st(0.28)), 0, 0, 0, 0, 0, 0.18);
}

// ---- hanger: a shaped wooden coat hanger with a polished brass hook and a trouser bar
function woodHanger(): O {
  const wd = M(0xc8864a, { tex: 'grain', rough: 0.45 }), brass = BRASS();
  const top: P2[] = [], bot: P2[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = -0.95 + (1.9 * i) / 24, u = Math.abs(x) / 0.95;
    const y = 0.12 - 0.44 * Math.pow(u, 1.5);
    const th = 0.15 - 0.06 * u;
    top.push([x, y]); bot.push([x, y - th]);
  }
  const body = ext(shape(roundPoly([...top, ...bot.reverse()], 0.05, 3)), 0.07, wd, 0.035, 3, 48);
  const bar = grp(rod([-0.8, -0.56, 0], [0.8, -0.56, 0], 0.04, wd, 16), ...[-1, 1].map((s) => tube([[s * 0.86, -0.36, 0], [s * 0.86, -0.46, 0], [s * 0.8, -0.56, 0]], 0.014, CHROME(), 8, 6)));
  const hook = grp(at(cyl(0.045, 0.055, 0.08, brass, 16), 0, 0.16, 0), tube([[0, 0.14, 0], [0, 0.36, 0], [0.03, 0.5, 0], [0.13, 0.6, 0], [0.25, 0.57, 0], [0.3, 0.46, 0], [0.27, 0.38, 0]], 0.03, brass, 48, 10), at(ball(0.036, brass, 12, 10), 0.27, 0.37, 0));
  return grp(body, bar, hook);
}

// ---- stats: three glass level tubes in a brass rack on a walnut plinth, filled to three heights
function levelTubes(): O {
  const walnut = M(0x6a3a22, { tex: 'grain', rough: 0.5 }), brass = BRASS();
  const plinth = at(ext(shape(rrectPts(1.56, 0.24, 0.06)), 0.5, walnut, 0.05, 3), 0, -0.84, 0);
  const g = grp(plinth, at(ext(shape(rrectPts(1.4, 0.05, 0.02)), 0.42, brass, 0.02, 2), 0, -0.68, 0));
  const fills: [number, number][] = [[0x7a5cc8, 0.5], [0x2f9a62, 0.86], [0xe0a030, 1.22]];
  fills.forEach(([c, h], i) => {
    const x = -0.46 + i * 0.46, y0 = -0.66;
    g.add(at(lathe(smoothProfile([[0, 0], [0.11, 0.01], [0.15, 0.06], [0.16, 0.14], [0.16, 1.38]], 3), clearGlass(0.24), 32), x, y0, 0));
    const liquid = M(c, { rough: 0.18, tex: 'plain', glow: 0.12, env: 1.1 });
    g.add(at(lathe(smoothProfile([[0, 0.02], [0.1, 0.03], [0.135, 0.08], [0.14, 0.14], [0.14, h - 0.02], [0.12, h], [0, h - 0.015]], 3), liquid, 32), x, y0, 0));
    g.add(at(torus(0.17, 0.03, brass, Math.PI * 2, 8, 32), x, y0 + 0.08, 0, Math.PI / 2), at(torus(0.17, 0.03, brass, Math.PI * 2, 8, 32), x, y0 + 1.3, 0, Math.PI / 2));
    g.add(at(lathe(smoothProfile([[0, 0.12], [0.1, 0.12], [0.17, 0.08], [0.18, 0.0], [0.15, -0.02], [0, -0.02]], 2), brass, 24), x, y0 + 1.4, 0));
  });
  g.add(rod([-0.7, 0.64, -0.2], [0.7, 0.64, -0.2], 0.025, brass), ...[-1, 1].map((s) => rod([s * 0.7, -0.66, -0.2], [s * 0.7, 0.64, -0.2], 0.03, brass)), ...[-1, 1].map((s) => at(ball(0.05, brass, 12, 10), s * 0.7, 0.66, -0.2)));
  return g;
}

// ---- nights: a night-sky medallion, deep blue enamel with a gold crescent and stars in a turned brass bezel
function nightMedal(): O {
  const g = grp(
    at(lathe(smoothProfile([[0, -0.08], [0.8, -0.08], [0.88, -0.05], [0.9, 0.02], [0.86, 0.08], [0.8, 0.09], [0.77, 0.05]], 3), BRASS(), 96), 0, 0, 0, Math.PI / 2),
    at(dome(circlePts(0.78, 96), vitreous(0x1c2a62, 0.3), 0.05, 0.04), 0, 0, 0),
  );
  const gold = gilt(0xf4c85a);
  g.add(at(dome(crescentPts(0.5, 0.42, [0.2, 0.14], 96), gold, 0.06, 0.025), -0.1, -0.04, 0.05));
  for (const [x, y, r] of [[0.36, 0.38, 0.16], [0.5, -0.18, 0.1], [0.12, 0.6, 0.07], [-0.45, 0.42, 0.06]] as [number, number, number][]) g.add(at(facetSolid(starPts(r, r * 0.45, 5), r * 0.3, r * 0.12, gold), x, y, 0.08));
  // a wisp of cloud across the moon
  g.add(at(dome(roundPoly([[-0.62, -0.5], [0.1, -0.5], [0.18, -0.42], [0.06, -0.36], [-0.12, -0.36], [-0.2, -0.3], [-0.42, -0.32], [-0.54, -0.38]], 0.05, 3), vitreous(0x8e9ccc, 0.4), 0.04, 0.03), 0, 0, 0.07));
  return g;
}

// ---- things: an open keepsake box, velvet lined, holding the treasures a little owl keeps
function keepsakeBox(): O {
  const oak = M(0xb8743a, { tex: 'grain', rough: 0.5 }), velvet = M(0x8a2438, { rough: 0.85, tex: 'felt' }), brass = BRASS();
  const W = 1.4, D = 0.9, Hb = 0.5;
  const box = grp(at(ext(shape(rrectPts(W, D, 0.06)), Hb, oak, 0.04, 3), 0, -0.55, 0, Math.PI / 2));
  // the lining (just inside the top edge) and the box's walls round it
  box.add(at(ext(shape(rrectPts(W - 0.14, D - 0.14, 0.03)), 0.02, velvet, 0.01, 1), 0, -0.29, 0, Math.PI / 2));
  // the lid, open and leaning back on its hinges, lined too
  const lid = grp(at(ext(shape(rrectPts(W, D, 0.06)), 0.08, oak, 0.035, 3), 0, 0.04, D / 2, Math.PI / 2),
    at(ext(shape(rrectPts(W - 0.16, D - 0.16, 0.03)), 0.02, velvet, 0.01, 1), 0, -0.05, D / 2, Math.PI / 2));
  box.add(at(lid, 0, -0.3, -D / 2, -1.85));
  // brass corner caps, the hinges and the clasp
  for (const s of [-1, 1]) for (const z of [-1, 1]) box.add(at(ext(shape(rrectPts(0.12, 0.5, 0.03)), 0.03, brass, 0.01, 1), s * (W / 2 + 0.005), -0.55, z * (D / 2 - 0.04), 0, Math.PI / 2, 0));
  box.add(at(ext(shape(roundPoly([[-0.1, 0.05], [0.1, 0.05], [0.1, -0.12], [0, -0.2], [-0.1, -0.12]], 0.03)), 0.03, brass, 0.012, 2), 0, -0.36, D / 2 + 0.03));
  // the treasures: a moon gem, an acorn, a feather, a blue glass marble, a string of pearls
  const pearl = M(0xf6eee2, { rough: 0.2, tex: null, env: 1.3 });
  const pearls = grp(); for (let i = 0; i < 11; i++) { const a = i * 0.42; pearls.add(at(ball(0.045, pearl, 12, 8), -0.32 + Math.cos(a) * 0.2 + i * 0.02, -0.25, 0.1 + Math.sin(a) * 0.14)); }
  const feather = at(grp(leafMesh(0.34, 0.1, M(0xe8dcc8, { rough: 0.7, tex: 'plain' }), 13), at(cyl(0.01, 0.012, 0.66, M(0xf0e6d0, { tex: null }), 6), 0, -0.04, 0.02)), 0.42, -0.02, -0.1, -0.3, 0, -0.9);
  const marble = at(ball(0.12, M(0x3a7ad0, { rough: 0.05, metal: 0.1, tex: null, env: 1.6, opacity: 0.85 }), 24, 16), -0.12, -0.16, 0.22);
  return grp(box, feather, pearls, marble, at(moonGem(), 0.1, -0.03, 0.06, 0.2, 0.4, -0.2, 0.34), at(acorn(0.42, 0.5), -0.42, -0.04, -0.06));
}

// ---- bell: a polished brass hand bell on a turned walnut handle, swinging, its clapper showing at the lip
function handBell(): O {
  const brass = BRASS(), walnut = M(0x5a3020, { tex: 'grain', rough: 0.45 });
  const body = lathe(smoothProfile([[0.08, 0.36], [0.16, 0.34], [0.22, 0.26], [0.26, 0.1], [0.3, -0.1], [0.4, -0.3], [0.56, -0.44], [0.62, -0.5], [0.62, -0.54], [0.56, -0.52], [0.5, -0.47]], 4), brass, 72);
  (body.material as THREE.Material).side = THREE.DoubleSide;
  const bands = grp(at(torus(0.3, 0.018, brass, Math.PI * 2, 6, 64), 0, -0.1, 0, Math.PI / 2), at(torus(0.6, 0.022, brass, Math.PI * 2, 6, 72), 0, -0.48, 0, Math.PI / 2));
  const collar = at(lathe(smoothProfile([[0.08, 0], [0.13, 0.02], [0.14, 0.07], [0.1, 0.1]], 2), brass, 24), 0, 0.34, 0);
  const handle = at(lathe(smoothProfile([[0.08, 0], [0.1, 0.04], [0.08, 0.12], [0.07, 0.24], [0.1, 0.38], [0.12, 0.5], [0.1, 0.6], [0.05, 0.64], [0, 0.65]], 4), walnut, 32), 0, 0.42, 0);
  const clapper = grp(rod([0, 0.2, 0], [0.05, -0.38, 0.1], 0.02, OLDBRASS()), at(ball(0.08, OLDBRASS(), 16, 12), 0.06, -0.46, 0.12));
  return at(grp(body, bands, collar, handle, clapper), 0, 0, 0, 0, 0, -0.32);
}

// ---- speaker: a brass horn on its black driver, sound rings (or a red cross) coming from its mouth
function hornSpeaker(): O {
  const brass = BRASS();
  const hornM = M(0xe9b24e, { metal: 0.92, rough: 0.24, tex: null, env: 1.15, side: THREE.DoubleSide });
  const horn = at(lathe(smoothProfile([[0.1, 0], [0.11, 0.2], [0.14, 0.42], [0.22, 0.62], [0.36, 0.78], [0.52, 0.88], [0.6, 0.9]], 4), hornM, 64), -0.5, 0, 0, 0, 0, -Math.PI / 2);
  const lip = at(torus(0.6, 0.025, brass, Math.PI * 2, 8, 72), 0.4, 0, 0, 0, Math.PI / 2, 0);
  const driver = grp(at(cyl(0.24, 0.24, 0.26, M(0x2a2430, { rough: 0.3, tex: 'plain' }), 40), -0.66, 0, 0, 0, 0, Math.PI / 2), at(torus(0.24, 0.025, brass, Math.PI * 2, 8, 48), -0.53, 0, 0, 0, Math.PI / 2, 0), at(torus(0.24, 0.025, brass, Math.PI * 2, 8, 48), -0.79, 0, 0, 0, Math.PI / 2, 0),
    at(lathe(smoothProfile([[0, 0.06], [0.1, 0.05], [0.13, 0], [0, -0.01]], 2), brass, 24), -0.79, 0, 0, 0, 0, Math.PI / 2));
  return grp(horn, lip, driver);
}
/** a sound ring: an arc of cloisonné, centred on (cx, 0) */
function soundArc(cx: number, r: number, half: number, m: THREE.Material): O {
  const arc: P2[] = []; for (let i = 0; i <= 20; i++) { const a = -half + (2 * half * i) / 20; arc.push([cx + Math.cos(a) * r, Math.sin(a) * r]); }
  return cloisonStroke(arc, 0.12, m, { rim: 0.04, wire: 0.02, h: 0.05 });
}

// ---- notes: ebony enamel in brass wire
const noteHead = (x: number, y: number, s: number): P2[] => circlePts(0.2 * s, 40).map(([px, py]) => [px * 1.3, py * 0.92] as P2).map(([px, py]) => [px * Math.cos(0.42) - py * Math.sin(0.42) + x, px * Math.sin(0.42) + py * Math.cos(0.42) + y] as P2);
function musicNotes(): O {
  const m = vitreous(0x2a2448, 0.3), o = { rim: 0.045, wire: 0.022, h: 0.06 };
  return grp(cloison(roundPoly([[-0.31, 0.6], [0.7, 0.84], [0.7, 0.6], [-0.31, 0.36]], 0.04), m, o),
    cloison(bar(0.1, 1.12, -0.25, 0.02), m, { ...o, z: 0.01 }), cloison(bar(0.1, 1.12, 0.65, 0.2), m, { ...o, z: 0.01 }),
    cloison(noteHead(-0.45, -0.56, 1), m, { ...o, z: 0.03 }), cloison(noteHead(0.45, -0.38, 1), m, { ...o, z: 0.03 }));
}
function musicNote(): O {
  const m = vitreous(0x2a2448, 0.3), o = { rim: 0.045, wire: 0.022, h: 0.06 };
  const flag = roundPoly([[0.08, 0.86], [0.24, 0.86], [0.3, 0.7], [0.5, 0.54], [0.58, 0.3], [0.5, 0.06], [0.48, 0.28], [0.36, 0.44], [0.16, 0.5]], 0.04);
  return grp(cloison(bar(0.13, 1.36, 0.12, 0.18), m, o), cloison(flag, m, { ...o, z: 0.01 }), cloison(noteHead(-0.16, -0.54, 1.5), m, { ...o, z: 0.03 }));
}

// ---- drop and rain: clear water, deep blue at the top shading to a bright caustic at the bottom
function waterMat(): THREE.MeshPhysicalMaterial {
  let m = physCache.get('water');
  if (!m) {
    const map = drawTex('waterdrop', 16, 128, (g) => { const lg = g.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, '#7fd0f4'); lg.addColorStop(0.35, '#2a8ad0'); lg.addColorStop(0.8, '#1c5ea8'); lg.addColorStop(1, '#2a6cb4'); g.fillStyle = lg; g.fillRect(0, 0, 16, 128); });
    m = new THREE.MeshPhysicalMaterial({ map, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 });
    physCache.set('water', m);
  }
  return m;
}
/** a drop (lathe, its texture running from the point to the bottom) */
function waterDrop(s = 1): O {
  const prof: P2[] = smoothProfile([[0, 0.85], [0.1, 0.62], [0.32, 0.22], [0.52, -0.16], [0.56, -0.42], [0.46, -0.68], [0.26, -0.8], [0, -0.83]], 4).map(([r, y]) => [r * s, y * s]);
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), 48);
  // the lathe's v runs along the profile from the point (v 0: the texture's bottom, deep blue) to the round bottom (bright)
  g.computeVertexNormals();
  const drop = mesh(g, waterMat());
  return grp(drop);
}
function cloudMat(): THREE.MeshStandardMaterial {
  const map = drawTex('cloudgrad', 16, 128, (g) => { const lg = g.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, '#f6faff'); lg.addColorStop(0.5, '#dfe6f2'); lg.addColorStop(1, '#8e9eba'); g.fillStyle = lg; g.fillRect(0, 0, 16, 128); });
  return faceMat(map, { rough: 0.75 });
}
function rainCloud(): O {
  const cl = cloud(cloudMat()) as THREE.Mesh;
  planarUV(cl.geometry); // white on top, a rain-grey belly
  return grp(at(cl, 0, 0.32, 0, 0, 0, 0, 1.05), ...([[-0.4, -0.52, 0.3], [0.08, -0.72, 0.34], [0.5, -0.48, 0.28]] as [number, number, number][]).map(([x, y, s]) => at(waterDrop(s), x, y, 0.15, 0, 0, -0.18)));
}

// ---- leaf: a fresh green leaf with its veins and a drop of dew
function leafFaceTex(c0: string, c1: string, rib: string, key: string): THREE.Texture {
  return drawTex('leafface-' + key, 128, 256, (g) => {
    const lg = g.createLinearGradient(0, 0, 128, 256); lg.addColorStop(0, c0); lg.addColorStop(1, c1);
    g.fillStyle = lg; g.fillRect(0, 0, 128, 256);
    grain(g, 128, 256, 0.06);
    g.strokeStyle = rib; g.lineCap = 'round';
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 256); g.lineTo(64, 6); g.stroke();
    g.lineWidth = 2.4;
    for (let i = 0; i < 8; i++) { const y = 225 - i * 27; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * 30, y - 22, 64 + s * 60, y - 58); g.stroke(); } }
  });
}
function freshLeaf(): O {
  const blade = leafMesh(0.92, 0.48, new THREE.MeshStandardMaterial({ map: leafFaceTex('#8ccc4c', '#3e8a2e', 'rgba(220,246,170,0.85)', 'green'), roughness: 0.42, side: THREE.DoubleSide }), 0);
  const stem = tube([[0, -0.9, 0.0], [0.02, -1.12, 0.02], [0.08, -1.26, 0.04]], 0.03, M(0x4a8a30, { rough: 0.5, tex: null }), 10, 6);
  return at(grp(blade, stem, at(waterDrop(0.16), 0.16, 0.1, 0.2)), 0, 0.15, 0, 0, 0, -0.4);
}

// ---- wd_feather: a banded pheasant feather with a white quill
function featherTex(): THREE.Texture {
  return drawTex('feather10', 128, 256, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, 256); lg.addColorStop(0, '#8e5e36'); lg.addColorStop(0.6, '#c49a66'); lg.addColorStop(1, '#efe2ca');
    g.fillStyle = lg; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(48,30,22,0.8)';
    for (let i = 0; i < 8; i++) { const y = 14 + i * 22; g.beginPath(); g.moveTo(0, y + 14); g.quadraticCurveTo(64, y - 6, 128, y + 14); g.lineTo(128, y + 19); g.quadraticCurveTo(64, y + 1, 0, y + 19); g.fill(); }
    g.strokeStyle = 'rgba(255,240,210,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 60; i++) { const y = i * 4.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64, y + 10); g.lineTo(64 + s * 64, y - 18); g.stroke(); } }
  });
}
function pheasantFeather(): O {
  const vane: P2[] = [];
  for (let i = 0; i <= 64; i++) { const t = (i / 64) * Math.PI * 2, y = Math.cos(t); const notch = (i === 18 || i === 44) ? 0.82 : 1; vane.push([Math.sin(t) * 0.27 * (1 - 0.3 * Math.max(0, y)) * (1 + 0.15 * Math.min(0, y)) * notch, y * 0.9 + 0.1]); }
  const me = ext(shape(vane), 0.02, faceMat(featherTex(), { rough: 0.7 }), 0.015, 2, 64);
  planarUV(me.geometry);
  const p = me.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - Math.abs(p.getX(i)) * 0.25 + Math.sin(p.getY(i) * 1.6) * 0.05);
  me.geometry.computeVertexNormals();
  const quill = tube([[0, -1.1, 0.04], [0, -0.6, 0.05], [0, 0.2, 0.04], [0, 0.96, 0.02]], 0.018, M(0xf4ead6, { rough: 0.5, tex: null }), 24, 6);
  const fluff = grp(...[-1, 1].map((s) => at(leafMesh(0.12, 0.05, M(0xf2e6d2, { rough: 0.9, tex: 'plain' }), 13), s * 0.06, -0.82, 0.02, 0, 0, s * 0.6)));
  return at(grp(me, quill, fluff), 0, 0.04, 0, 0, 0, -0.55);
}

// ---- wd_sweater: a hand-knitted jumper with long sleeves, ribbed collar, cuffs and hem, and a heart on the front
function knitJumper(col = 0x356a48): O {
  const knit = M(col, { rough: 0.9, tex: 'knit', rep: 2 }), rib = M(0xefe0c0, { rough: 0.9, tex: 'knit' });
  const out: P2[] = roundPoly([[-0.22, 0.68], [0.22, 0.68], [0.56, 0.58], [0.82, 0.24], [0.98, -0.34], [0.72, -0.42], [0.56, -0.02], [0.5, -0.7], [-0.5, -0.7], [-0.56, -0.02], [-0.72, -0.42], [-0.98, -0.34], [-0.82, 0.24], [-0.56, 0.58]], 0.08, 4);
  const body = at(dome(out, knit, 0.14, 0.05, 5), 0, 0, 0);
  const hem = at(dome(rrectPts(1.02, 0.18, 0.07), rib, 0.14, 0.06, 4), 0, -0.68, 0.02);
  const cuff = (s: number) => at(dome(rrectPts(0.3, 0.14, 0.06), rib, 0.13, 0.05, 4), s * 0.86, -0.4, 0.02, 0, 0, s * 0.36);
  const collar = at(torus(0.2, 0.065, rib, Math.PI, 10, 24), 0, 0.68, 0.12, 0, 0, Math.PI, [1.1, 0.7, 1]);
  // knit-in rows of contrast and a heart
  const stripe = (y: number) => at(dome(rrectPts(0.98, 0.06, 0.02), rib, 0.03, 0.02, 2), 0, y, 0.13);
  const heart = at(dome(HEART.map(([x, y]) => [x * 0.2, y * 0.2] as P2), M(0xc0443e, { rough: 0.85, tex: 'knit' }), 0.04, 0.025, 3), 0, -0.1, 0.14);
  return grp(body, hem, cuff(-1), cuff(1), collar, stripe(-0.44), stripe(0.24), heart);
}

// ---- wd_mirror: a hand mirror in an engraved brass frame, its glass holding the room's soft light
function mirrorTex(): THREE.Texture {
  return drawTex('mirror10', 128, 160, (g) => {
    const lg = g.createLinearGradient(0, 0, 128, 160); lg.addColorStop(0, '#e6f2f8'); lg.addColorStop(0.5, '#a8c8dc'); lg.addColorStop(1, '#6e8fa8');
    g.fillStyle = lg; g.fillRect(0, 0, 128, 160);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.moveTo(20, 60); g.lineTo(60, 10); g.lineTo(78, 10); g.lineTo(30, 72); g.fill();
    g.beginPath(); g.moveTo(36, 84); g.lineTo(88, 20); g.lineTo(96, 24); g.lineTo(42, 92); g.fill();
  });
}
function handMirror(): O {
  const brass = BRASS();
  const glassM = new THREE.MeshStandardMaterial({ map: mirrorTex(), roughness: 0.08, metalness: 0.3, envMapIntensity: 1.2 });
  const face = mesh(planarUV(new THREE.CircleGeometry(0.46, 64)), glassM);
  const g = grp(at(face, 0, 0.32, 0.04, 0, 0, 0, [1, 1.22, 1]), at(torus(0.48, 0.07, brass, Math.PI * 2, 12, 72), 0, 0.32, 0.03, 0, 0, 0, [1, 1.2, 1]),
    at(ext(shape(circlePts(0.52, 64)), 0.06, OLDBRASS(), 0.03, 2), 0, 0.32, -0.04, 0, 0, 0, [1, 1.2, 1]));
  // beads round the rim and a little crest on top
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; g.add(at(ball(0.03, brass, 10, 8), Math.cos(a) * 0.56, 0.32 + Math.sin(a) * 0.67, 0.0)); }
  g.add(at(facetSolid(starPts(0.12, 0.05, 5), 0.04, 0.04, brass), 0, 0.98, 0.02));
  g.add(at(lathe(smoothProfile([[0.06, -0.46], [0.09, -0.4], [0.06, -0.3], [0.05, -0.1], [0.07, 0], [0.1, 0.04], [0.07, 0.08]], 3), brass, 24), 0, -0.4, 0), at(ball(0.075, brass, 16, 12), 0, -0.9, 0));
  return g;
}

// ---- bp_lamp: a table lamp with a pleated linen shade glowing warm, on a turned brass column and a walnut foot
function tableLamp(): O {
  const shadeG = new THREE.LatheGeometry(smoothProfile([[0.3, 0.3], [0.46, 0.0], [0.62, -0.28]], 3).map(([r, y]) => new THREE.Vector2(r, y)), 96);
  const p = shadeG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.abs(Math.sin(a * 16)) * 0.035; p.setX(i, x * k); p.setZ(i, z * k); }
  shadeG.computeVertexNormals();
  const linen = M(0xf4d8a4, { rough: 0.85, glow: 0.28, tex: 'weave', side: THREE.DoubleSide });
  const shade = mesh(shadeG, linen);
  const trim = M(0x9a3a2e, { rough: 0.7, tex: 'weave' });
  const brass = BRASS();
  return grp(at(shade, 0, 0.62, 0), at(torus(0.31, 0.022, trim, Math.PI * 2, 6, 48), 0, 0.92, 0, Math.PI / 2), at(torus(0.63, 0.026, trim, Math.PI * 2, 6, 72), 0, 0.34, 0, Math.PI / 2),
    at(lathe(smoothProfile([[0, -0.14], [0.12, -0.12], [0.16, 0], [0.1, 0.12], [0, 0.16]], 3), M(0xfff4cc, { glow: 1.1, tex: null }), 24), 0, 0.48, 0),
    at(lathe(smoothProfile([[0.04, -0.7], [0.07, -0.6], [0.05, -0.4], [0.14, -0.2], [0.16, -0.05], [0.1, 0.1], [0.05, 0.2], [0.035, 0.36]], 3), brass, 32), 0, 0, 0),
    at(lathe(smoothProfile([[0, -0.86], [0.42, -0.86], [0.46, -0.8], [0.4, -0.74], [0.2, -0.7], [0, -0.69]], 3), M(0x5a3020, { tex: 'grain', rough: 0.45 }), 48), 0, 0, 0),
    tube([[0.07, -0.2, 0.02], [0.1, -0.24, 0.12], [0.1, -0.32, 0.14]], 0.012, brass, 8, 5), at(ball(0.03, brass, 10, 8), 0.1, -0.34, 0.14));
}

// ---- lantern: a brass lantern, glass panes round a warm flame, a ring to carry it
function lantern10(): O {
  const brass = BRASS(), old = OLDBRASS();
  const g = grp(at(lathe(smoothProfile([[0, 0], [0.5, 0], [0.54, 0.04], [0.5, 0.1], [0.42, 0.14], [0, 0.14]], 2), brass, 48), 0, -0.84, 0),
    at(cyl(0.4, 0.4, 0.98, clearGlass(0.18), 32), 0, -0.2, 0),
    at(ball(0.26, new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.22, depthWrite: false }), 20, 14), 0, -0.26, 0),
    at(ball(0.16, new THREE.MeshBasicMaterial({ color: 0xffd470, transparent: true, opacity: 0.4, depthWrite: false }), 16, 12), 0, -0.26, 0),
    at(lathe(smoothProfile([[0, -0.16], [0.08, -0.08], [0.07, 0.06], [0.03, 0.18], [0, 0.24]], 3), C.flame(), 16), 0, -0.3, 0), at(lathe(smoothProfile([[0, -0.1], [0.045, -0.04], [0.03, 0.06], [0, 0.12]], 2), C.flameIn(), 12), 0, -0.33, 0.02),
    at(cyl(0.1, 0.12, 0.12, old, 20), 0, -0.62, 0),
    at(lathe(smoothProfile([[0.5, 0], [0.46, 0.08], [0.34, 0.18], [0.2, 0.28], [0.14, 0.34], [0.14, 0.42], [0, 0.44]], 3), brass, 48), 0, 0.3, 0),
    at(torus(0.18, 0.04, brass, Math.PI * 2, 8, 32), 0, 0.88, 0), at(cyl(0.05, 0.05, 0.12, brass, 12), 0, 0.72, 0));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; g.add(at(cyl(0.04, 0.04, 1.04, brass, 10), Math.cos(a) * 0.42, -0.2, Math.sin(a) * 0.42)); }
  for (const y of [-0.66, 0.26]) g.add(at(torus(0.42, 0.03, brass, Math.PI * 2, 6, 48), 0, y, 0, Math.PI / 2));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(at(ball(0.035, old, 8, 6), Math.cos(a) * 0.3, 0.46, Math.sin(a) * 0.3)); }
  return g;
}

// ---- phone_off: a phone asleep (a moon on its dark screen) struck through with a red enamel bar
function phoneScreen(): THREE.Texture {
  return drawTex('phonescreen', 96, 168, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, 168); lg.addColorStop(0, '#1e2a5a'); lg.addColorStop(1, '#3a2a5e');
    g.fillStyle = lg; g.fillRect(0, 0, 96, 168);
    g.fillStyle = '#f4d47a'; g.beginPath(); g.arc(30, 40, 18, 0, 7); g.fill();
    g.fillStyle = '#1f2b5b'; g.beginPath(); g.arc(39, 33, 16, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,240,200,0.8)'; for (const [x, y, r] of [[22, 30, 2], [74, 36, 1.6], [30, 112, 1.4], [70, 120, 2]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  });
}
function phoneAsleep(): O {
  const body = ext(shape(rrectPts(0.84, 1.5, 0.16)), 0.08, M(0x3a3440, { rough: 0.3, tex: 'plain' }), 0.04, 3);
  const screen = at(mesh(planarUV(new THREE.PlaneGeometry(0.72, 1.3)), faceMat(phoneScreen(), { rough: 0.1, glow: 0.35 })), 0, 0.0, 0.082);
  const edge = at(ext(shape(rrectPts(0.88, 1.54, 0.18)), 0.05, BRASS(), 0.02, 2), 0, 0, -0.02);
  return grp(edge, body, screen, at(cloisonStroke([[-0.62, -0.66], [0.62, 0.66]], 0.2, vitreous(CINNABAR), { rim: 0.05, wire: 0.022, h: 0.06 }), 0, 0, 0.14));
}

// ---- map: a folded parchment map, inked coast, hatched hills, a dotted path to an X and a compass rose
function mapTex10(): THREE.Texture {
  return drawTex('map10', 288, 192, (g) => {
    g.fillStyle = '#efdcae'; g.fillRect(0, 0, 288, 192);
    grain(g, 288, 192, 0.08);
    // the sea, then the land with its inked coast
    g.fillStyle = '#9cc4c8'; g.fillRect(0, 0, 288, 192);
    g.fillStyle = '#ecd7a4';
    g.beginPath(); g.moveTo(-10, 40); g.bezierCurveTo(60, 10, 120, 60, 170, 30); g.bezierCurveTo(230, 0, 270, 40, 300, 30); g.lineTo(300, 200); g.lineTo(-10, 200); g.closePath(); g.fill();
    g.strokeStyle = '#5a4030'; g.lineWidth = 2.5; g.stroke();
    g.strokeStyle = 'rgba(90,64,48,0.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-10, 32); g.bezierCurveTo(60, 2, 120, 52, 170, 22); g.bezierCurveTo(230, -8, 270, 32, 300, 22); g.stroke();
    grain(g, 288, 192, 0.06);
    // woods and hills
    for (const [x, y] of [[40, 90], [56, 104], [30, 112], [70, 88], [200, 140], [216, 128], [230, 146]]) { g.fillStyle = '#6a8a48'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.strokeStyle = '#3e5a30'; g.lineWidth = 1.5; g.stroke(); }
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 2.2;
    for (const [x, y] of [[130, 80], [154, 74], [176, 84]]) { g.beginPath(); g.moveTo(x - 14, y + 10); g.lineTo(x, y - 8); g.lineTo(x + 14, y + 10); g.stroke(); }
    // the path and the X
    g.strokeStyle = '#a8342a'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(24, 170); g.bezierCurveTo(90, 130, 120, 170, 160, 120); g.bezierCurveTo(190, 90, 220, 110, 248, 80); g.stroke(); g.setLineDash([]);
    g.lineWidth = 4.5; g.beginPath(); g.moveTo(240, 72); g.lineTo(258, 90); g.moveTo(258, 72); g.lineTo(240, 90); g.stroke();
    // a compass rose
    g.fillStyle = '#5a4030'; g.save(); g.translate(254, 160);
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -18); g.lineTo(4, 0); g.lineTo(-4, 0); g.fill(); }
    g.restore();
  });
}
function foldedMap(): O {
  const g = grp(), tx = mapTex10();
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(0.64, 1.36, 2, 8);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3);
    const p = mesh(geo, new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.85 }));
    g.add(at(p, -0.6 + i * 0.6, 0, i % 2 ? -0.1 : 0.02, 0, i % 2 ? 0.32 : -0.32, 0));
  }
  return g;
}

// ---- bp_rug: a braided rag rug, rings of plaited cloth in old rose, cream, sage, mustard and indigo, round an oval
function braidedRug(): O {
  const cols = [0x9a3a32, 0xeadcc0, 0x6a8a5a, 0xc8963a, 0x3a4a7a, 0xeadcc0, 0x9a3a32, 0x6a8a5a];
  const g = grp(at(cyl(0.2, 0.2, 0.06, M(0xc8963a, { rough: 0.9, tex: 'weave' }), 32), 0, 0, 0));
  cols.forEach((c, i) => {
    const R = 0.22 + i * 0.1, m = M(c, { rough: 0.9, tex: 'weave' });
    const ring = torus(R, 0.055, m, Math.PI * 2, 8, 96);
    // a plait: the rope swells and twists along its length
    const p = ring.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), a = Math.atan2(y, x), r = Math.hypot(x, y), d = r - R, sw = 1 + Math.sin(a * (40 + i * 10)) * 0.25; p.setXY(k, Math.cos(a) * (R + d * sw), Math.sin(a) * (R + d * sw)); p.setZ(k, p.getZ(k) * sw); }
    ring.geometry.computeVertexNormals();
    g.add(at(ring, 0, 0, 0, Math.PI / 2));
  });
  return at(g, 0, 0, 0, 0, 0, 0, [1.25, 1, 0.85]);
}

// ---- bp_wallpaper: a roll of sprigged wallpaper (sage vines and rosebuds on cream), a length unrolled, a paste brush
function sprigTex(): THREE.Texture {
  const t = drawTex('sprig', 128, 128, (g) => {
    g.fillStyle = '#f2e6cc'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#dfe2c0'; for (const x of [0, 64]) g.fillRect(x + 50, 0, 14, 128);
    grain(g, 128, 128, 0.05);
    for (const [ox, oy] of [[26, 8], [90, 72], [26, 72], [90, 8]]) {
      g.strokeStyle = '#4e7044'; g.lineWidth = 3; g.beginPath(); g.moveTo(ox, oy); g.bezierCurveTo(ox - 14, oy + 16, ox + 14, oy + 30, ox, oy + 48); g.stroke();
      g.fillStyle = '#5e8650'; for (const [dx, dy, a] of [[-8, 12, -0.8], [8, 26, 0.8], [-6, 38, -0.6]]) { g.save(); g.translate(ox + dx, oy + dy); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 8, 4, 0, 0, 7); g.fill(); g.restore(); }
      g.fillStyle = '#b8485e'; g.beginPath(); g.arc(ox, oy + 2, 7, 0, 7); g.fill(); g.fillStyle = '#e88a9a'; g.beginPath(); g.arc(ox - 1.5, oy, 3, 0, 7); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function wallpaperRoll(): O {
  const t = sprigTex();
  const rollM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
  const rollG = new THREE.CylinderGeometry(0.32, 0.32, 1.46, 48);
  const uv = rollG.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 1.4);
  const sheetG = new THREE.PlaneGeometry(0.9, 1.46, 12, 2);
  const sp = sheetG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin((sp.getX(i) + 0.45) * 2.4) * 0.12);
  sheetG.computeVertexNormals();
  const su = sheetG.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < su.count; i++) su.setXY(i, su.getX(i) * 1.1, su.getY(i) * 1.4);
  const sheet = mesh(sheetG, new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, side: THREE.DoubleSide }));
  const ends = M(0xe8d8b8, { rough: 0.8, tex: 'paper' });
  return grp(at(mesh(rollG, rollM), -0.4, 0, 0), at(cyl(0.12, 0.12, 1.48, M(0xb89466, { rough: 0.8, tex: 'paper' }), 24), -0.4, 0, 0), at(cyl(0.3, 0.3, 1.47, ends, 48), -0.4, 0, 0), at(sheet, 0.32, -0.02, 0.24, 0, -0.25, 0));
}

// ---- bp_season: a present wrapped in deep green paper with gold pinstripes, a red satin bow, a sprig of holly
function giftPaper(): THREE.Texture {
  const t = drawTex('giftpaper', 64, 64, (g) => { g.fillStyle = '#2e5a3e'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(230,190,100,0.75)'; g.lineWidth = 1.6; for (const x of [8, 40]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); } g.fillStyle = 'rgba(230,190,100,0.75)'; for (const [x, y] of [[24, 16], [56, 48]]) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}
function seasonGift(): O {
  const paperM = new THREE.MeshStandardMaterial({ map: giftPaper(), roughness: 0.5 });
  const satin = M(0xb02a30, { rough: 0.3, tex: 'plain', env: 1.1 });
  const box = mesh(new THREE.BoxGeometry(1.1, 0.86, 1.1), paperM);
  const lid = at(mesh(new THREE.BoxGeometry(1.18, 0.22, 1.18), paperM), 0, 0.46, 0);
  const g = grp(at(box, 0, -0.1, 0), lid,
    at(mesh(new THREE.BoxGeometry(0.18, 1.1, 1.2), satin), 0, 0.02, 0), at(mesh(new THREE.BoxGeometry(1.2, 1.1, 0.18), satin), 0, 0.02, 0));
  const loop = (a: number) => { const l = torus(0.22, 0.075, satin, Math.PI * 2, 12, 36); l.scale.set(1.2, 1, 0.6); return at(grp(l), Math.cos(a) * 0.2, 0.68, Math.sin(a) * 0.2, 0, -a, 0.55); };
  g.add(loop(0), loop(Math.PI), at(ball(0.09, satin, 16, 12), 0, 0.64, 0));
  // holly: two glossy leaves and three berries tucked into the bow
  const holly = M(0x2a6a34, { rough: 0.25, tex: 'plain' }), berry = M(0xc8202a, { rough: 0.2, tex: null, env: 1.2 });
  g.add(at(leafMesh(0.14, 0.065, holly, 7), 0.12, 0.6, 0.62, -0.3, 0, -1.0), at(leafMesh(0.14, 0.065, holly, 7), -0.12, 0.6, 0.62, -0.3, 0, 1.0));
  for (const [x, y] of [[0, 0.62], [0.06, 0.56], [-0.06, 0.56]]) g.add(at(ball(0.045, berry, 12, 10), x, y, 0.66));
  return g;
}

// ---- bp_buy: a kraft price tag with a brass eyelet, a red string and an acorn stamped in sepia ink
function tagFace(): THREE.Texture {
  return drawTex('buytag', 192, 128, (g) => {
    g.fillStyle = '#d8b07a'; g.fillRect(0, 0, 192, 128);
    grain(g, 192, 128, 0.1);
    g.strokeStyle = 'rgba(110,60,30,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.strokeRect(10, 10, 140, 108); g.setLineDash([]);
    // the stamped acorn
    g.fillStyle = '#6a3a1e';
    g.beginPath(); g.ellipse(72, 74, 26, 30, 0, 0, Math.PI); g.lineTo(46, 66); g.fill();
    g.beginPath(); g.ellipse(72, 58, 32, 16, 0, Math.PI, 0); g.lineTo(104, 64); g.lineTo(40, 64); g.fill();
    g.fillRect(70, 30, 4, 14);
    g.fillStyle = '#d8b07a'; g.beginPath(); g.ellipse(64, 78, 6, 12, 0.3, 0, 7); g.fill();
  });
}
function priceTag(): O {
  const out: P2[] = roundPoly([[-0.8, -0.52], [0.34, -0.52], [0.86, 0], [0.34, 0.52], [-0.8, 0.52]], 0.08);
  const sh = shape(out), hl = new THREE.Path(); hl.absarc(0.52, 0, 0.09, 0, Math.PI * 2, true); sh.holes.push(hl);
  const card = ext(sh, 0.04, faceMat(tagFace(), { rough: 0.9 }), 0.015, 1, 48);
  planarUV(card.geometry);
  return grp(card, at(torus(0.11, 0.03, BRASS(), Math.PI * 2, 8, 32), 0.52, 0, 0.03), tube([[0.52, 0.1, 0.03], [0.6, 0.32, 0.1], [0.66, 0.62, 0.08], [0.6, 0.9, 0]], 0.022, M(0xa83028, { rough: 0.8, tex: 'weave' }), 16, 6));
}

// ---- bp_decor: a glazed stoneware vase (celadon running to a toasty foot, a painted band) holding three flowers
function vaseTex(): THREE.Texture {
  return drawTex('vase10', 32, 128, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, '#3a6e8c'); lg.addColorStop(0.75, '#4e8aa8'); lg.addColorStop(0.86, '#8ab4bc'); lg.addColorStop(0.9, '#c89a6a'); lg.addColorStop(1, '#9a6a44');
    g.fillStyle = lg; g.fillRect(0, 0, 32, 128);
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 44, 32, 4); g.fillRect(0, 54, 32, 2);
    g.fillStyle = '#e8dcc0'; for (let x = 2; x < 32; x += 8) { g.beginPath(); g.arc(x, 50, 1.8, 0, 7); g.fill(); }
  });
}
function flowerVase(): O {
  const prof = smoothProfile([[0, -0.85], [0.3, -0.85], [0.42, -0.7], [0.5, -0.45], [0.46, -0.2], [0.3, 0.0], [0.2, 0.08], [0.22, 0.18], [0.26, 0.2]], 4);
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), 48);
  geo.computeVertexNormals();
  const vase = mesh(geo, new THREE.MeshStandardMaterial({ map: vaseTex(), roughness: 0.22, envMapIntensity: 1.1 }));
  const stemM = M(0x4a7a34, { rough: 0.5, tex: null });
  const flower = (x: number, y: number, c: number, n: number, r: number) => {
    const pet: P2[] = Array.from({ length: 80 }, (_, i) => { const a = (i / 80) * Math.PI * 2, rr = r * (0.55 + 0.45 * Math.abs(Math.cos(a * n / 2))); return [Math.cos(a) * rr, Math.sin(a) * rr]; });
    return grp(tube([[0, 0.05, 0], [x * 0.5, y * 0.55, 0.02], [x, y, 0.04]], 0.028, stemM, 12, 5), at(dome(pet, M(c, { rough: 0.6, tex: 'plain' }), 0.04, 0.025, 3), x, y, 0.06, -0.2, 0, 0), at(dome(circlePts(r * 0.28, 24), M(0xe8a830, { rough: 0.7, tex: 'plain' }), 0.04, 0.02, 2), x, y + 0.01, 0.1, -0.2, 0, 0));
  };
  return grp(vase, flower(-0.3, 0.72, 0xd8607a, 5, 0.2), flower(0.08, 0.95, 0xf2c84a, 6, 0.2), flower(0.38, 0.62, 0xf4eee6, 8, 0.18),
    at(leafMesh(0.2, 0.08, stemM), -0.14, 0.36, 0.06, 0, 0, 0.8), at(leafMesh(0.2, 0.08, stemM), 0.2, 0.4, 0.06, 0, 0, -0.9));
}

// ---- calendar: a tear-off day calendar, a bookcloth header with brass rings, a big day numeral, a page curling up
function dayPage(): THREE.Texture {
  return drawTex('daypage', 160, 160, (g) => {
    g.fillStyle = '#fbf3e0'; g.fillRect(0, 0, 160, 160);
    grain(g, 160, 160, 0.04);
    g.fillStyle = '#a8342a'; g.font = 'bold 26px Georgia, "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MON', 80, 40);
    g.fillStyle = '#3a2c2a'; g.font = 'bold 92px Georgia, "DejaVu Serif", serif'; g.fillText('7', 80, 106);
    g.strokeStyle = 'rgba(90,70,60,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 58); g.lineTo(136, 58); g.stroke();
  });
}
function dayCalendar(): O {
  const cloth = M(0x8e2a26, { rough: 0.75, tex: 'weave' });
  const page = at(mesh(planarUV(new THREE.PlaneGeometry(1.2, 1.2)), faceMat(dayPage(), { rough: 0.9 })), 0, -0.2, 0.125);
  const pad = at(ext(shape(rrectPts(1.3, 1.3, 0.06)), 0.18, M(0xf4ead2, { rough: 0.9, tex: 'paper' }), 0.02, 1), 0, -0.2, 0);
  const back = at(ext(shape(rrectPts(1.4, 1.62, 0.08)), 0.06, M(0x6a3a22, { tex: 'grain', rough: 0.55 }), 0.03, 2), 0, -0.08, -0.14);
  const header = at(ext(shape(rrectPts(1.44, 0.36, 0.08)), 0.26, cloth, 0.04, 3), 0, 0.6, 0.02);
  // the last torn page's stub, and the next page lifting at its corner
  const curlG = new THREE.PlaneGeometry(0.5, 0.5, 6, 6);
  const cp = curlG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i) + 0.25, y = -cp.getY(i) + 0.25, d = (x + y) / 1.4; cp.setZ(i, d * d * 0.5); }
  curlG.computeVertexNormals();
  const curl = at(mesh(curlG, M(0xf6eedc, { rough: 0.9, tex: 'paper', side: THREE.DoubleSide })), 0.4, -0.6, 0.13, 0, 0, 0);
  const rings = [-0.42, 0, 0.42].map((x) => at(torus(0.11, 0.03, BRASS(), Math.PI * 2, 8, 24), x, 0.43, 0.2, 0, Math.PI / 2, 0));
  return grp(back, pad, page, curl, header, ...rings);
}

// ---- waves: three rolling swells in cloisonné, deep sea to shallow
function seaWaves(): O {
  const swell = (y: number, ph: number): P2[] => Array.from({ length: 33 }, (_, k) => { const x = -0.86 + (1.72 * k) / 32; return [x, y + Math.sin(x * 4.2 + ph) * 0.12] as P2; });
  return grp(...([[0.5, 0x5aa8d0], [0, 0x2f7ab8], [-0.5, 0x1e5494]] as [number, number][]).map(([y, c], i) => cloisonStroke(swell(y, i * 0.7), 0.2, vitreous(c), { z: i * 0.02 })));
}

// ---- pen: a fountain pen in black lacquer with gold bands, a clip, and a two-tone gold nib with its slit
function fountainPen(): O {
  const lac = M(0x1e1a24, { rough: 0.16, tex: 'plain', env: 1.2 }), gold = M(0xf0c458, { metal: 0.9, rough: 0.2, tex: null, env: 1.2 });
  const barrel = lathe(smoothProfile([[0, 0.92], [0.07, 0.9], [0.12, 0.82], [0.14, 0.6], [0.145, 0.2], [0.14, -0.1], [0.12, -0.3], [0.1, -0.36]], 3), lac, 32);
  const bands = grp(at(torus(0.146, 0.022, gold, Math.PI * 2, 8, 32), 0, 0.2, 0, Math.PI / 2), at(torus(0.14, 0.014, gold, Math.PI * 2, 6, 32), 0, 0.28, 0, Math.PI / 2), at(torus(0.1, 0.016, gold, Math.PI * 2, 6, 24), 0, -0.36, 0, Math.PI / 2));
  const clip = grp(tube([[0, 0.86, 0.13], [0, 0.82, 0.18], [0, 0.4, 0.17], [0, 0.32, 0.15]], 0.025, gold, 16, 6), at(ball(0.035, gold, 10, 8), 0, 0.32, 0.15));
  const grip = at(lathe(smoothProfile([[0.1, 0], [0.095, -0.12], [0.085, -0.22]], 2), lac, 24), 0, -0.36, 0);
  // the nib: a curved gold blade with a breather hole and its slit
  const nibPts: P2[] = [[-0.085, 0], [0.085, 0], [0.06, -0.18], [0.0, -0.36], [-0.06, -0.18]];
  const nibG = new THREE.ExtrudeGeometry(shape(nibPts), { depth: 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
  const np = nibG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < np.count; i++) { const x = np.getX(i); np.setZ(i, np.getZ(i) - x * x * 4); }
  nibG.computeVertexNormals();
  const nib = at(mesh(nibG, gold), 0, -0.58, 0.07);
  const slit = rod([0, -0.68, 0.085], [0, -0.92, 0.075], 0.006, M(0x1e1a24, { tex: null }), 6);
  const hole = at(cyl(0.016, 0.016, 0.02, M(0x1e1a24, { tex: null }), 12), 0, -0.68, 0.082, Math.PI / 2);
  const feed = at(lathe([[0.07, 0], [0.05, -0.14], [0.02, -0.26], [0, -0.28]], M(0x2a2428, { rough: 0.5, tex: null }), 16), 0, -0.58, -0.02);
  return at(grp(barrel, bands, clip, grip, feed, nib, slit, hole), 0, 0, 0, 0.1, 0, -0.72);
}

// ---- magnifier: a reading glass, its lens in a brass ring joined by a ferrule to a turned walnut handle
function readingGlass(): O {
  const brass = BRASS();
  const lens = at(lathe(smoothProfile([[0, 0.045], [0.25, 0.04], [0.44, 0.02], [0.48, 0]], 3).concat(smoothProfile([[0.48, 0], [0.44, -0.02], [0.25, -0.04], [0, -0.045]], 3)), M(0xd2ecfa, { rough: 0.03, metal: 0.1, tex: null, env: 1.8, opacity: 0.26 }), 48), 0, 0, 0, Math.PI / 2);
  const ring = grp(at(torus(0.5, 0.06, brass, Math.PI * 2, 12, 64), 0, 0, 0), at(torus(0.5, 0.035, OLDBRASS(), Math.PI * 2, 8, 64), 0, 0, -0.05));
  const neck = grp(rod([0.39, -0.39, 0], [0.52, -0.52, 0], 0.05, brass), at(lathe(smoothProfile([[0.07, 0], [0.085, 0.05], [0.085, 0.14], [0.07, 0.18]], 2), brass, 24), 0.6, -0.6, 0, 0, 0, Math.PI * 0.75));
  const handle = at(lathe(smoothProfile([[0.07, 0], [0.09, 0.1], [0.08, 0.24], [0.1, 0.42], [0.11, 0.56], [0.09, 0.66], [0, 0.7]], 3), M(0x5a3020, { tex: 'grain', rough: 0.4 }), 24), 0.72, -0.72, 0, 0, 0, Math.PI * 0.75);
  return at(grp(lens, ring, neck, handle), -0.2, 0.25, 0);
}

// ---- birdhouse: an oak birdhouse with a cedar-shingled roof, a round door with a worn rim, a perch, on its post
function birdhouse10(): O {
  const oak = M(0xd09a5a, { tex: 'grain', rough: 0.6 }), walnut = M(0x6a3a22, { tex: 'grain', rough: 0.6 });
  const sh = shingles('#9a5232').map.clone();
  sh.wrapS = sh.wrapT = THREE.RepeatWrapping; sh.repeat.set(1.2, 1.2); sh.needsUpdate = true;
  const roofM = new THREE.MeshStandardMaterial({ map: sh, bumpMap: sh, bumpScale: 0.6, roughness: 0.75 });
  const body = ext(shape([[-0.45, -0.7], [0.45, -0.7], [0.45, 0.1], [0, 0.48], [-0.45, 0.1]]), 0.8, oak, 0.03, 2);
  const roof = grp(...[-1, 1].map((s) => { const m = mesh(new THREE.BoxGeometry(0.8, 0.08, 1.04), roofM); return at(m, s * 0.27, 0.36, 0, 0, 0, -s * 0.72); }), at(cyl(0.05, 0.05, 1.08, walnut, 12), 0, 0.6, 0, Math.PI / 2));
  const door = grp(at(cyl(0.14, 0.14, 0.04, M(0x1e1418, { rough: 0.9, tex: null }), 24), 0, -0.06, 0.42, Math.PI / 2), at(torus(0.15, 0.03, M(0xa87440, { tex: 'grain', rough: 0.6 }), Math.PI * 2, 8, 32), 0, -0.06, 0.43));
  const perch = grp(at(cyl(0.028, 0.028, 0.26, walnut, 10), 0, -0.36, 0.52, Math.PI / 2), at(ball(0.035, walnut, 10, 8), 0, -0.36, 0.65));
  const ring = at(torus(0.07, 0.02, BRASS(), Math.PI * 2, 8, 20), 0, 0.72, 0);
  const post = at(mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), walnut), 0, -0.95, 0);
  return grp(body, roof, door, perch, ring, post);
}

// ------------------------------------------------------------------ the icon models
type Make = () => O | Promise<O>;
/** `edge`: [icons10] how dark the faint edge is (0.35; pale things such as a white glove or air on parchment want more) */
interface Spec { make: Make; yaw?: number; pitch?: number; pad?: number; fin?: Finish; edge?: number }
const glb = (path: string, fix?: (o: O) => void): Make => async () => { const { root } = await instanceGLB(path); fix?.(root); root.userData.glb = true; return root; };
/**
 * Ready a model for the bake: the bake's own textured materials laid on at the icons' density (a painted face, a
 * borrowed model's own textures keep their coordinates).
 */
function prep(obj: O): O {
  obj.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    for (const m of Array.isArray(me.material) ? me.material : [me.material]) if (!ownMats.has(m) && !(m as THREE.Material).userData.shelfMat) keepUV(m);
  });
  if (!obj.userData.glb) fitUV(obj, ICON_DENS);
  return obj;
}
const T = 0.3; // token depth

const EMERALD = 0x1c7442, CINNABAR = 0xa02c24, COBALT = 0x2a4f9c, ROSE = 0xae3e5a;
const CHECK: P2[] = [[-0.72, 0.02], [-0.24, -0.46], [0.74, 0.6]];
const ICONS: Record<string, Spec> = {
  check: { make: () => cloisonStroke(CHECK, 0.36, vitreous(EMERALD)), yaw: 0.24, pitch: 0.24 },
  cross: { make: () => grp(cloisonStroke([[-0.6, -0.6], [0.6, 0.6]], 0.34, vitreous(CINNABAR)), cloisonStroke([[-0.6, 0.6], [0.6, -0.6]], 0.34, vitreous(CINNABAR), { z: 0.07 })), yaw: 0.24, pitch: 0.24 },
  plus: { make: () => medal(EMERALD, [roundPoly([[-0.13, 0.46], [0.13, 0.46], [0.13, 0.13], [0.46, 0.13], [0.46, -0.13], [0.13, -0.13], [0.13, -0.46], [-0.13, -0.46], [-0.13, -0.13], [-0.46, -0.13], [-0.46, 0.13], [-0.13, 0.13]], 0.05)]), yaw: 0.24, pitch: 0.22 },
  minus: { make: () => medal(ROSE, [bar(0.92, 0.26)]), yaw: 0.24, pitch: 0.22 },
  info: { make: () => medal(COBALT, [circlePts(0.12, 32).map(([x, y]) => [x + 0.02, y + 0.42] as P2), roundPoly([[-0.18, 0.2], [0.11, 0.2], [0.11, -0.32], [0.21, -0.32], [0.21, -0.5], [-0.21, -0.5], [-0.21, -0.32], [-0.09, -0.32], [-0.09, 0.04], [-0.18, 0.04]], 0.03)]), yaw: 0.24, pitch: 0.22 },
  arrow_right: { make: () => cloison(ARROW, vitreous(EMERALD)), yaw: 0.24, pitch: 0.24 },
  arrow_left: { make: () => cloison(mirrorX(ARROW), vitreous(EMERALD)), yaw: 0.24, pitch: 0.24 },
  arrow_up: { make: () => cloison(rot(ARROW, Math.PI / 2), vitreous(EMERALD)), yaw: 0.24, pitch: 0.24 },
  arrow_down: { make: () => cloison(rot(ARROW, -Math.PI / 2), vitreous(ROSE)), yaw: 0.24, pitch: 0.24 },
  rotate_right: { make: () => curvedArrow(vitreous(COBALT), true), yaw: 0.24, pitch: 0.24 },
  rotate_left: { make: () => at(curvedArrow(vitreous(COBALT), true), 0, 0, 0, 0, 0, 0, [-1, 1, 1]), yaw: -0.24, pitch: 0.24 }, // the mirror of rotate_right
  play: { make: () => cloison(roundPoly([[-0.44, -0.66], [0.72, 0], [-0.44, 0.66]], 0.16), vitreous(EMERALD)), yaw: 0.24, pitch: 0.22 },
  pause: { make: () => grp(cloison(bar(0.34, 1.12, -0.3), vitreous(COBALT)), cloison(bar(0.34, 1.12, 0.3), vitreous(COBALT))), yaw: 0.24, pitch: 0.22 },
  lock: {
    make: () => {
      const keyhole = shape([...Array.from({ length: 24 }, (_, i) => { const a = -Math.PI / 3 + (i / 23) * ((Math.PI * 5) / 3); return [Math.cos(a) * 0.1, 0.06 + Math.sin(a) * 0.1] as P2; }), [-0.06, -0.22], [0.06, -0.22]]);
      const brass = M(0xe0a646, { metal: 0.6, rough: 0.3, tex: null, env: 1.15 }), dark = M(0x9a6a2a, { metal: 0.6, rough: 0.4, tex: null });
      return grp(at(ext(shape(rrectPts(1.12, 0.9, 0.2)), 0.3, brass, 0.12, 5), 0, -0.3, 0),
        at(torus(0.31, 0.09, C.steel(), Math.PI, 14, 32), 0, 0.22, 0), at(cyl(0.09, 0.09, 0.3, C.steel(), 14), -0.31, 0.08, 0), at(cyl(0.09, 0.09, 0.3, C.steel(), 14), 0.31, 0.08, 0),
        at(ext(shape(circlePts(0.2, 40)), 0.04, dark, 0.03, 2), 0, -0.3, 0.27), at(ext(keyhole, 0.03, C.ink(), 0.01, 1), 0, -0.32, 0.31),
        ...[[-0.42, -0.02], [0.42, -0.02], [-0.42, -0.6], [0.42, -0.6]].map(([x, y]) => at(ball(0.045, dark, 10, 8), x, y, 0.25)));
    }, yaw: 0.38, pitch: 0.24,
  },
  star: { make: () => grp(goldStar(0.98, 0.44), at(ext(shape(offsetPts(starPts(0.98, 0.44), 0.05)), 0.06, M(0xb07a2a, { metal: 0.6, rough: 0.35, tex: null }), 0.02, 1), 0, 0, -0.06)), yaw: 0.22, pitch: 0.22 },
  heart: { make: () => cloison(HEART, vitreous(0xb83a52), { h: 0.1 }), yaw: 0.24, pitch: 0.24 },
  sparkle: { make: () => grp(goldStar(0.98, 0.26, 4), at(goldStar(0.34, 0.12, 4, M(0xfff0c0, { metal: 0.3, rough: 0.3, tex: null, glow: 0.25 })), 0.64, 0.62, 0.12)), yaw: 0.22, pitch: 0.22 },
  moon: { make: () => moonJewel(0.86, 0.72, [0.38, 0.22]), yaw: 0.28, pitch: 0.26 },
  sun: { make: () => { const g = grp(facetSolid(circlePts(0.52, 16), 0.16, 0.14, gilt())); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(at(facetSolid([[-0.14, 0], [0.14, 0], [0, 0.34]], 0.08, 0.08, gilt(0xec9a34), 0, 0.1), Math.cos(a) * 0.62, Math.sin(a) * 0.62, -0.02, 0, 0, a - Math.PI / 2)); } return g; }, yaw: 0.22, pitch: 0.22 },
  shield: { make: () => { const pts = roundPoly([[-0.7, 0.78], [0.7, 0.78], [0.7, 0.06], [0.48, -0.44], [0, -0.88], [-0.48, -0.44], [-0.7, 0.06]], 0.1); return grp(cloison(pts, vitreous(COBALT), { rim: 0.08 }), at(goldStar(0.4, 0.18), 0, 0.06, 0.16)); }, yaw: 0.24, pitch: 0.22 },
  zzz: { make: () => sleepyZ(), yaw: 0.22, pitch: 0.2 },
  bolt: { make: () => cloison(roundPoly([[0.15, 0.95], [-0.55, -0.1], [-0.05, -0.1], [-0.25, -0.95], [0.55, 0.15], [0.05, 0.15]], 0.05), vitreous(0xe8a028, 0.3)), yaw: 0.24, pitch: 0.24 },
  ice_flake: { make: () => { const ice = M(0x9ad2ee, { rough: 0.18, metal: 0.1, env: 1.2, tex: 'glass' }), g = grp(jewel(circlePts(0.16, 6), ice, { rim: 0, depth: 0.08, bevel: 0.05 })); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 2, c = Math.cos(a), s = Math.sin(a); g.add(strokeMesh([[c * 0.1, s * 0.1], [c * 0.92, s * 0.92]], 0.1, ice, 0.08, 0.035)); for (const fr of [0.48, 0.72]) { const px = c * fr, py = s * fr, l = fr < 0.6 ? 0.24 : 0.17; for (const sg of [-1, 1]) g.add(strokeMesh([[px, py], [px + Math.cos(a + sg * 0.75) * l, py + Math.sin(a + sg * 0.75) * l]], 0.08, ice, 0.07, 0.03)); } } return g; }, yaw: 0.24, pitch: 0.24 },
  alarm: { make: () => alarmClock(), yaw: 0.3, pitch: 0.14 },
  clock: { make: () => { const c = cuckooClock(); simpleDial(c.root); boldHands(c); setClockHands(c, new Date(2024, 0, 1, 10, 10, 0)); c.pendulum.rotation.z = 0.2; return c.root; }, yaw: 0.22, pitch: 0.1 },
  hourglass: {
    make: () => { const cap = (y: number, flip: number) => at(lathe(smoothProfile([[0, 0], [0.6, 0], [0.64, 0.05], [0.6, 0.1], [0.5, 0.12], [0, 0.12]], 2), C.wood(), 32), 0, y, 0, flip ? Math.PI : 0);
      return grp(cap(-0.9, 0), cap(0.9, 1), ...[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.5; return at(lathe(smoothProfile([[0.05, -0.8], [0.065, -0.4], [0.045, 0], [0.065, 0.4], [0.05, 0.8]], 2), C.dark(), 8), Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); }),
        lathe(smoothProfile([[0.4, -0.78], [0.44, -0.5], [0.3, -0.2], [0.07, 0], [0.3, 0.2], [0.44, 0.5], [0.4, 0.78]], 3), M(0xbfe8ff, { rough: 0.05, metal: 0.1, opacity: 0.45, tex: null, env: 1.6 }), 32),
        lathe(smoothProfile([[0, -0.77], [0.39, -0.76], [0.3, -0.5], [0.12, -0.34], [0, -0.3]], 2), M(0xf4c058, { rough: 0.8 }), 24), lathe([[0, 0.05], [0.16, 0.18], [0.28, 0.32], [0, 0.32]], M(0xf4c058, { rough: 0.8 }), 24), at(cyl(0.015, 0.015, 0.36, M(0xf4c058, { rough: 0.8 }), 6), 0, -0.14, 0)); }, yaw: 0.4, pitch: 0.2,
  },
  calendar: { make: () => dayCalendar(), yaw: 0.28, pitch: 0.16 },
  candle: {
    make: () => grp(lathe(smoothProfile([[0, -0.78], [0.6, -0.76], [0.66, -0.68], [0.62, -0.62], [0.24, -0.6], [0.22, -0.56], [0, -0.56]], 2), C.brass(), 40),
      at(lathe(smoothProfile([[0, -0.6], [0.25, -0.6], [0.26, 0.2], [0.24, 0.3], [0.1, 0.32], [0, 0.3]], 2), M(0xfff1d8, { rough: 0.55, tex: 'wax' }), 28), 0, 0, 0),
      tube([[0.22, 0.28, 0.12], [0.27, 0.12, 0.12], [0.27, -0.02, 0.1]], 0.04, M(0xfff1d8, { rough: 0.55, tex: 'wax' }), 8, 6),
      at(cyl(0.02, 0.02, 0.12, C.ink(), 6), 0, 0.38, 0),
      at(lathe(smoothProfile([[0, -0.2], [0.13, -0.1], [0.12, 0.05], [0.05, 0.2], [0, 0.3]], 2), C.flame(), 16), 0, 0.6, 0), at(lathe(smoothProfile([[0, -0.12], [0.06, -0.05], [0.04, 0.08], [0, 0.14]], 2), C.flameIn(), 12), 0, 0.56, 0.05),
      at(torus(0.16, 0.05, C.brass(), Math.PI, 8, 16), 0.64, -0.62, 0, 0, 0, -Math.PI / 2)), yaw: 0.4, pitch: 0.24,
  },
  lantern: { make: () => lantern10(), yaw: 0.4, pitch: 0.2 },
  nest: { make: () => twigNest(), yaw: 0.3, pitch: 0.5 },
  bell: { make: () => handBell(), yaw: 0.3, pitch: 0.2 },
  phone_off: { make: () => phoneAsleep(), yaw: 0.28, pitch: 0.18 },
  music: { make: () => musicNotes(), yaw: 0.22, pitch: 0.2 },
  note: { make: () => musicNote(), yaw: 0.22, pitch: 0.2 },
  mic: { make: () => micro(), yaw: 0.3, pitch: 0.16 },
  speaker_on: { make: () => grp(hornSpeaker(), soundArc(0.12, 0.62, 0.62, vitreous(COBALT)), soundArc(0.12, 0.86, 0.55, vitreous(COBALT))), yaw: 0.22, pitch: 0.12 },
  speaker_off: { make: () => grp(hornSpeaker(), at(grp(cloisonStroke([[0.5, -0.3], [0.98, 0.3]], 0.15, vitreous(CINNABAR), { rim: 0.04, wire: 0.02, h: 0.05 }), cloisonStroke([[0.5, 0.3], [0.98, -0.3]], 0.15, vitreous(CINNABAR), { rim: 0.04, wire: 0.02, h: 0.05, z: 0.05 })), 0, 0, 0.2)), yaw: 0.22, pitch: 0.12 },
  rain: { make: () => rainCloud(), yaw: 0.24, pitch: 0.16, edge: 0.5 },
  drop: { make: () => waterDrop(), yaw: 0.3, pitch: 0.16 },
  waves: { make: () => seaWaves(), yaw: 0.22, pitch: 0.22 },
  wind: { make: () => windGusts(), yaw: 0.12, pitch: 0.1, edge: 0.6 },
  campfire: {
    make: () => { const bark = M(0x7a4a26, { tex: 'bark', rough: 0.85 }), end = M(0xe8b070, { tex: 'grain', rough: 0.7 });
      const log = (a: number, tilt: number) => { const g = grp(at(cyl(0.13, 0.15, 1.3, bark, 12), 0, 0, 0), at(cyl(0.13, 0.13, 0.01, end, 12), 0, 0.655, 0), at(cyl(0.15, 0.15, 0.01, end, 12), 0, -0.655, 0)); return at(g, 0, -0.58, 0, Math.PI / 2 - tilt, a, 0); };
      const stone = (a: number) => at(lathe(smoothProfile([[0, 0.12], [0.16, 0.1], [0.2, 0.02], [0.16, -0.06], [0, -0.07]], 2), M(0x9aa0a8, { rough: 0.8, tex: 'stone' }), 10), Math.cos(a) * 0.74, -0.74, Math.sin(a) * 0.74, 0, a, 0);
      return grp(log(0.5, 0.25), log(-0.6, 0.2), log(1.7, 0.18), ...[0, 1.2, 2.4, 3.6, 4.8].map(stone),
        ...([[0, 0, 1], [-0.2, -0.04, 0.7], [0.22, 0.02, 0.75], [0.06, -0.06, 0.55]] as [number, number, number][]).map(([x, z, k]) => at(lathe(smoothProfile([[0, -0.4], [0.3, -0.25], [0.28, 0], [0.14, 0.35], [0, 0.66]], 3), C.flame(), 16), x, -0.1, z, 0, 0, x * 0.6, [k * 0.8, k, k * 0.8])),
        at(lathe(smoothProfile([[0, -0.3], [0.2, -0.15], [0.15, 0.08], [0, 0.3]], 3), C.flameIn(), 16), 0, -0.2, 0.18), at(lathe(smoothProfile([[0, -0.1], [0.08, -0.04], [0.05, 0.06], [0, 0.12]], 2), unlit(0xfff4c0), 10), 0, -0.24, 0.26)); }, yaw: 0.4, pitch: 0.34,
  },
  leaf: { make: () => freshLeaf(), yaw: 0.3, pitch: 0.3 },
  book: { make: () => { const b = journal(); b.ribbon.visible = false; return b.root; }, yaw: 0.5, pitch: 0.2 },
  pen: { make: () => fountainPen(), yaw: 0.3, pitch: 0.3 },
  jar: { make: () => fireflyJar(), yaw: 0.3, pitch: 0.16, edge: 0.55 },
  hanger: { make: () => woodHanger(), yaw: 0.26, pitch: 0.16 },
  brush: {
    make: () => at(grp(lathe(smoothProfile([[0, -0.8], [0.08, -0.78], [0.1, -0.3], [0.08, 0.2], [0.1, 0.3]], 2), C.wood(), 16), at(lathe(smoothProfile([[0.1, 0], [0.13, 0.1], [0.13, 0.25], [0.11, 0.32]], 2), C.silver(), 16), 0, 0.28, 0),
      at(lathe(smoothProfile([[0.11, 0], [0.14, 0.12], [0.11, 0.3], [0, 0.42]], 3), M(0xf2d9a0, { tex: 'grain' }), 16), 0, 0.6, 0), at(lathe(smoothProfile([[0.09, 0], [0.06, 0.1], [0, 0.16]], 2), C.blue(), 12), 0, 0.92, 0)), 0, 0, 0, 0, 0, -0.75), yaw: 0.3, pitch: 0.3,
  },
  pushpin: { make: () => at(grp(lathe(smoothProfile([[0, 0.7], [0.36, 0.66], [0.38, 0.56], [0.2, 0.5], [0.18, 0.2], [0.42, 0.1], [0.44, 0.02], [0, 0]], 3), C.red(), 32), at(cyl(0.025, 0.012, 0.6, C.silver(), 8), 0, -0.3, 0)), 0, 0, 0, 0, 0, 0.55), yaw: 0.4, pitch: 0.3 },
  magnifier: { make: () => readingGlass(), yaw: 0.28, pitch: 0.2 },
  clipboard: {
    make: () => { const ruled = faceTex('ruled', 24, 32, (x, y): RGB => (y > 6 && y % 5 === 0 && x > 3 && x < 21 ? hex('#8a90b8') : y > 4 && y < 9 && x > 3 && x < 14 ? hex('#5a4a6a') : hex('#fbf2dc')));
      return grp(ext(shape(rrectPts(1.2, 1.56, 0.1)), 0.06, C.wood(), 0.03, 2), at(mesh(planarUV(new THREE.PlaneGeometry(1.0, 1.24)), new THREE.MeshStandardMaterial({ map: ruled, roughness: 0.85 })), 0, -0.08, 0.075),
        at(ext(shape([[-0.3, -0.1], [0.3, -0.1], [0.26, 0.12], [0.12, 0.16], [0.08, 0.26], [-0.08, 0.26], [-0.12, 0.16], [-0.26, 0.12]]), 0.08, C.silver(), 0.03, 2), 0, 0.66, 0.08)); }, yaw: 0.3, pitch: 0.2,
  },
  satchel: {
    make: () => { const lea = C.leather(), dk = M(0x8a3420, { rough: 0.55, tex: 'leather' });
      return grp(at(ext(shape(rrectPts(1.36, 1.0, 0.22)), 0.36, lea, 0.12, 3), 0, -0.24, 0), at(ext(shape([[-0.7, 0.26], [0.7, 0.26], [0.7, -0.14], [0.5, -0.32], [-0.5, -0.32], [-0.7, -0.14]]), 0.06, dk, 0.04, 2), 0, 0.02, 0.24),
        ...[-0.32, 0.32].map((x) => grp(at(ext(shape(rrectPts(0.12, 0.5, 0.04)), 0.02, dk, 0.01, 1), x, -0.2, 0.3), at(ext(shape(rrectPts(0.18, 0.14, 0.03)), 0.03, C.brass(), 0.015, 1), x, -0.32, 0.32))),
        tube([[-0.6, 0.2, 0], [-0.52, 0.72, 0], [0, 0.94, 0], [0.52, 0.72, 0], [0.6, 0.2, 0]], 0.06, dk, 24, 8)); }, yaw: 0.34, pitch: 0.22,
  },
  map: { make: () => foldedMap(), yaw: 0.2, pitch: 0.25 },
  gear: { make: () => gear(M(0xe6ae50, { metal: 0.55, rough: 0.32, tex: 'plain', env: 1.0 }), 10, M(0xa8722e, { metal: 0.6, rough: 0.36, tex: 'plain' })), yaw: 0.3, pitch: 0.3 },
  treehouse: {
    make: () => { const lv = [M(0x4caa3c, { rough: 0.6, tex: 'foliage' }), M(0x62c448, { rough: 0.6, tex: 'foliage' }), M(0x3e9434, { rough: 0.6, tex: 'foliage' })];
      const clump = (x: number, y: number, r: number, m: THREE.Material) => { const g = new THREE.IcosahedronGeometry(r, 2); const p = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(1 + (fbm(v.x * 6 + 3, v.y * 6 + v.z * 4, 5) - 0.5) * 0.35); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return at(mesh(g, m), x, y, 0); };
      const house = grp(ext(shape([[-0.26, -0.2], [0.26, -0.2], [0.26, 0.14], [0, 0.34], [-0.26, 0.14]]), 0.3, C.oak(), 0.03, 2), at(ext(shape([[-0.34, 0.1], [0, 0.4], [0.34, 0.1], [0.3, 0.06], [0, 0.32], [-0.3, 0.06]]), 0.38, C.red(), 0.03, 2), 0, 0.02, 0), at(ext(shape(rrectPts(0.14, 0.18, 0.05)), 0.02, M(0xffd87a, { glow: 0.7, tex: null }), 0.01, 1), 0, -0.02, 0.17));
      return grp(at(lathe(smoothProfile([[0.34, -1.0], [0.24, -0.8], [0.18, -0.3], [0.16, 0.2]], 2), M(0x8a5a32, { tex: 'bark' }), 16), 0, 0, 0), clump(-0.34, 0.34, 0.46, lv[0]), clump(0.32, 0.4, 0.5, lv[2]), clump(0, 0.7, 0.46, lv[1]), at(house, 0.02, -0.36, 0.22)); }, yaw: 0.3, pitch: 0.18,
  },
  birdhouse: { make: () => birdhouse10(), yaw: 0.45, pitch: 0.2 },
  cursor_hand: { make: () => cartoonGlove(), yaw: 0.26, pitch: 0.14, edge: 0.75 },
  stats: { make: () => levelTubes(), yaw: 0.36, pitch: 0.16 },
  nights: { make: () => nightMedal(), yaw: 0.24, pitch: 0.22 },
  things: { make: () => keepsakeBox(), yaw: 0.42, pitch: 0.42 },
  seals: { make: () => { const pts: P2[] = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, r = 0.62 + Math.sin(a * 7) * 0.04 + (h2(i, 1, 2) - 0.5) * 0.04; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.2]); } const rib = M(0x2f4f8a, { rough: 0.35, tex: 'weave' }), wax = M(0xb0302c, { rough: 0.32, tex: 'plain' }); const tail = (s: number) => at(ext(shape(roundPoly([[s * -0.1, -0.1], [s * 0.12, -0.1], [s * 0.38, -0.96], [s * 0.28, -0.84], [s * 0.18, -1.0]], 0.02)), 0.04, rib, 0.02, 1), 0, 0, -0.12); return grp(tail(-1), tail(1), ext(shape(pts), 0.16, wax, 0.1, 4), at(torus(0.38, 0.05, M(0x8a2024, { rough: 0.35, tex: 'plain' }), Math.PI * 2, 8, 48), 0, 0.2, 0.15), at(goldStar(0.26, 0.11, 5, M(0xd04a40, { rough: 0.3, tex: 'plain' })), 0, 0.2, 0.16)); }, yaw: 0.26, pitch: 0.26 },
  wd_feather: { make: () => pheasantFeather(), yaw: 0.26, pitch: 0.26 },
  tophat: { make: () => grp(lathe(smoothProfile([[0, -0.5], [0.95, -0.5], [0.98, -0.44], [0.62, -0.4], [0.56, -0.3], [0.55, 0.5], [0.6, 0.6], [0, 0.62]], 2), M(0x3a2a52, { rough: 0.45, tex: 'felt' }), 48), at(cyl(0.565, 0.57, 0.2, C.red(), 40), 0, -0.26, 0), at(ext(shape(rrectPts(0.2, 0.16, 0.04)), 0.04, C.gold(), 0.02, 1), 0.2, -0.26, 0.55, 0, 0.35, 0)), yaw: 0.4, pitch: 0.32 },
  wd_glasses: { make: () => grp(...[-0.48, 0.48].map((x) => at(torus(0.36, 0.075, C.gold(), Math.PI * 2, 10, 40), x, 0, 0)), ...[-0.48, 0.48].map((x) => at(cyl(0.33, 0.33, 0.03, M(0x8fd8ff, { rough: 0.06, metal: 0.2, tex: null, env: 2 }), 32), x, 0, -0.01, Math.PI / 2)), at(torus(0.14, 0.055, C.gold(), Math.PI, 8, 16), 0, 0.08, 0), ...[-1, 1].map((sx) => tube([[sx * 0.84, 0.1, -0.02], [sx * 0.92, 0.12, -0.3], [sx * 0.9, 0.0, -0.5]], 0.04, C.gold(), 12, 6))), yaw: 0.3, pitch: 0.2 },
  wd_scarf: { make: () => { const st = new THREE.MeshStandardMaterial({ map: stripeTex(['#b8322e', '#efdcb8', '#b8322e', '#2f4f8a'], [3, 1, 3, 1]), roughness: 0.8, side: THREE.DoubleSide }); const fr = M(0xefdcb8, { rough: 0.8, tex: 'weave' }); const drape = ribbon([[-0.2, -0.95, 0.12], [-0.17, -0.2, 0.1], [-0.08, 0.32, 0.08], [0.04, 0.44, 0], [0.16, 0.32, -0.08], [0.24, -0.2, -0.1], [0.28, -0.75, -0.1]], 0.38, st, { normal: [0, 0, 1], seg: 48 }); const fringe = (x: number, y: number, z: number) => grp(...[0, 1, 2, 3, 4].map((i) => at(cyl(0.022, 0.022, 0.15, fr, 5), x - 0.14 + i * 0.07, y - 0.08, z))); return grp(at(hanger(), 0.04, 0.62, 0, 0, 0, 0, 0.62), drape, fringe(-0.2, -0.95, 0.12), fringe(0.28, -0.75, -0.1)); }, yaw: 0.3, pitch: 0.16 },
  wd_sweater: { make: () => knitJumper(), yaw: 0.26, pitch: 0.14 },
  wd_cape: { make: () => { const vel = M(0x5a3a8a, { rough: 0.6, tex: 'felt' }), lin = M(0xc8963e, { rough: 0.4, tex: 'plain' }); const prof = smoothProfile([[0.88, -0.86], [0.74, -0.4], [0.62, 0.1], [0.56, 0.36], [0.44, 0.5], [0.2, 0.56]], 3).map(([x, y]) => V2c(x, y)); const shell = (r: number, m: THREE.Material, side: THREE.Side) => { const geo = new THREE.LatheGeometry(prof.map((p) => V2c(p.x * r, p.y)), 48, 0.2, Math.PI * 2 - 0.4); const p = geo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), t = Math.max(0, (0.2 - y) / 1.06), k = 1 + Math.sin(a * 6) * 0.12 * t; p.setXYZ(i, x * k, y, z * k); } geo.computeVertexNormals(); const me = mesh(geo, m); (me.material as THREE.Material).side = side; return me; }; return grp(shell(1, vel, THREE.FrontSide), shell(0.97, lin, THREE.BackSide), at(torus(0.3, 0.1, M(0x7a52b0, { rough: 0.6, tex: 'felt' }), Math.PI * 2, 10, 32), 0, 0.52, 0, Math.PI / 2, 0, 0, [1, 1, 0.7]), at(jewel(crescentPts(0.13, 0.11, [0.06, 0.035], 48), C.gold(), { rim: 0, depth: 0.04, bevel: 0.03 }), 0, 0.44, 0.3), at(hanger(), 0, 0.72, -0.05, 0, 0, 0, 0.55)); }, yaw: 0.35, pitch: 0.2 },
  wd_mirror: { make: () => handMirror(), yaw: 0.26, pitch: 0.16 },
  wd_frame: { make: () => grp(at(torus(0.66, 0.18, C.brass(), Math.PI * 2, 14, 48), 0, 0, 0), at(cyl(0.56, 0.56, 0.06, M(0x6ec2f0, { rough: 0.5 }), 40), 0, 0, -0.05, Math.PI / 2), ...[0, 1, 2, 3].map((i) => at(ext(shape(starPts(0.12, 0.05, 4)), 0.06, C.gold(), 0.03, 2), Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.66, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.66, 0.16))), yaw: 0.3, pitch: 0.2 },
  bp_box: {
    make: () => { const k = C.kraft(), tape = M(0xeedcae, { rough: 0.6, tex: null });
      const box = ext(shape(rrectPts(1.3, 0.9, 0.03)), 1.0, k, 0.02, 1);
      const flap = (px: number, pz: number, ry: number, w: number, tilt: number) => { const g = grp(at(ext(shape(rrectPts(w, 0.46, 0.02)), 0.025, k, 0.01, 1), 0, 0.23, 0)); g.position.set(px, 0.45, pz); g.rotation.order = 'YXZ'; g.rotation.set(tilt, ry, 0); return g; };
      return grp(box, flap(0, 0.5, 0, 1.28, 0.55), flap(0, -0.5, Math.PI, 1.28, 0.4), flap(0.65, 0, Math.PI / 2, 0.98, 0.7), flap(-0.65, 0, -Math.PI / 2, 0.98, 0.6), at(ext(shape(rrectPts(0.3, 0.92, 0.01)), 0.03, tape, 0.01, 1), 0, 0, 0.52)); }, yaw: 0.6, pitch: 0.34,
  },
  bp_bed: {
    make: () => { const wood = M(0xc8803e, { tex: 'grain', rough: 0.55 });
      const quiltT = faceTex('quilt', 16, 16, (x, y): RGB => { const c = [hex('#e05a5a'), hex('#f4d070'), hex('#5aa0e0'), hex('#6ac080')][(Math.floor(x / 4) + Math.floor(y / 4) * 3) % 4]; return x % 4 === 0 || y % 4 === 0 ? hex('#fff2dc') : c; });
      const quilt = new THREE.MeshStandardMaterial({ map: quiltT, roughness: 0.8 });
      const head = ext(shape([[-0.55, -0.1], [0.55, -0.1], [0.55, 0.5], ...Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * 0.55, 0.5 + Math.sin(a) * 0.22] as P2; })]), 0.1, wood, 0.03, 2);
      const foot = ext(shape(rrectPts(1.1, 0.4, 0.08)), 0.1, wood, 0.03, 2);
      const qg = new THREE.BoxGeometry(1.04, 0.1, 1.1); const uv = qg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
      return grp(at(head, 0, 0, -0.8), at(foot, 0, -0.18, 0.8), at(ext(shape(rrectPts(1.04, 0.22, 0.06)), 1.56, M(0xfff6ea, { rough: 0.8, tex: 'weave' }), 0.03, 2), 0, 0.02, 0), at(mesh(qg, quilt), 0, 0.16, 0.22),
        at(ext(shape(rrectPts(0.6, 0.18, 0.09)), 0.34, M(0xffffff, { rough: 0.8, tex: 'weave' }), 0.06, 3), 0, 0.22, -0.52, -0.2), at(ext(shape(rrectPts(1.16, 0.12, 0.04)), 1.7, wood, 0.02, 1), 0, -0.14, 0), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => at(cyl(0.05, 0.05, 0.3, C.dark(), 8), sx * 0.52, -0.3, sz * 0.78)))); }, yaw: 0.65, pitch: 0.42,
  },
  bp_chair: { make: glb('items/armchair.glb'), yaw: 0.6, pitch: 0.28 },
  bp_table: { make: glb('items/round_table.glb'), yaw: 0.6, pitch: 0.34 },
  bp_shelf: { make: glb('items/bookshelf.glb'), yaw: 0.45, pitch: 0.2 },
  bp_lamp: { make: () => tableLamp(), yaw: 0.4, pitch: 0.2 },
  bp_plant: { make: glb('items/fernpot.glb'), yaw: 0.5, pitch: 0.3 },
  bp_rug: { make: () => braidedRug(), yaw: 0.2, pitch: 0.9 },
  bp_wall: { make: () => { const gold = M(0xd8a040, { metal: 0.6, rough: 0.32, tex: 'plain' }); const outer = shape(rrectPts(1.7, 1.32, 0.06)), hole = new THREE.Path(); rrectPts(1.36, 0.98, 0.02).forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y))); outer.holes.push(hole); const pic = mesh(planarUV(new THREE.PlaneGeometry(1.4, 1.02)), new THREE.MeshStandardMaterial({ map: landscape(), roughness: 0.8 })); return grp(ext(outer, 0.12, gold, 0.06, 3), at(pic, 0, 0, -0.02), at(ext(shape(rrectPts(1.44, 1.06, 0.02)), 0.04, M(0x8a5a26, { metal: 0.5, rough: 0.4, tex: 'plain' }), 0.015, 1), 0, 0, -0.06)); }, yaw: 0.22, pitch: 0.12 },
  bp_decor: { make: () => flowerVase(), yaw: 0.3, pitch: 0.2 },
  bp_fun: { make: glb('items/rocking_horse.glb'), yaw: 0.7, pitch: 0.24 },
  bp_wallpaper: { make: () => wallpaperRoll(), yaw: 0.4, pitch: 0.2, edge: 0.55 },
  bp_floor: { make: () => grp(...[-0.5, 0, 0.5].map((x, i) => at(ext(shape(rrectPts(0.46, 1.5, 0.04)), 0.12, [C.wood(), C.oak(), C.dark()][i], 0.02, 1), x, 0, i === 1 ? 0.06 : 0, -Math.PI / 2))), yaw: 0.5, pitch: 0.6 },
  bp_season: { make: () => seasonGift(), yaw: 0.6, pitch: 0.3 },
  bp_move: { make: () => cloison(roundPoly([[-0.12, 0.12], [-0.12, 0.5], [-0.32, 0.5], [0, 0.9], [0.32, 0.5], [0.12, 0.5], [0.12, 0.12], [0.5, 0.12], [0.5, 0.32], [0.9, 0], [0.5, -0.32], [0.5, -0.12], [0.12, -0.12], [0.12, -0.5], [0.32, -0.5], [0, -0.9], [-0.32, -0.5], [-0.12, -0.5], [-0.12, -0.12], [-0.5, -0.12], [-0.5, -0.32], [-0.9, 0], [-0.5, 0.32], [-0.5, 0.12]], 0.04), vitreous(COBALT)), yaw: 0.24, pitch: 0.24 },
  bp_buy: { make: () => priceTag(), yaw: 0.22, pitch: 0.22 },
  tool_build: { make: () => blueprint(), yaw: 0.22, pitch: 0.12 },
  tool_shop: { make: () => shopStall(), yaw: 0.32, pitch: 0.14 },
  tool_dress: { make: () => topHat(), yaw: 0.35, pitch: 0.3 },
  tool_quests: { make: () => questScroll(), yaw: 0.22, pitch: 0.12 },
  tool_map: { make: () => globe(), yaw: 0.26, pitch: 0.14 },
  tool_settings: { make: () => grp(at(gear(M(0xe6ae50, { metal: 0.55, rough: 0.32, tex: 'plain', env: 1.0 }), 10, M(0xa8722e, { metal: 0.6, rough: 0.36, tex: 'plain' })), -0.12, 0.1, 0, 0, 0, 0, 0.85), at(gear(M(0xb8c0cc, { metal: 0.75, rough: 0.3, tex: 'plain', env: 1.1 }), 8, M(0x7a8290, { metal: 0.7, rough: 0.36, tex: 'plain' })), 0.55, -0.55, 0.05, 0, 0, 0.3, 0.42)), yaw: 0.3, pitch: 0.28 },
  // the currency
  owlcoin: { make: () => bigAcorn9(), yaw: 0.25, pitch: 0.18 },
  coin_pouch: { make: () => grp(acornBag({ pouch: 'leather', spill: 0 }), at(acorn(0.78, 0.5), 0.68, -0.5, 0.55)), yaw: 0.3, pitch: 0.2 },
  coin_sack: { make: () => grp(at(acornBag({ spill: 0 }), 0, 0, 0, 0, 0, 0, [1.1, 1.06, 1.1]), at(acorn(0.72, 0.55), 0.78, -0.56, 0.55), at(acorn(0.66, -0.5), -0.76, -0.62, 0.5)), yaw: 0.3, pitch: 0.2 },
  coin_chest: { make: () => {
    const wood = M(0x6a3420, { tex: 'grain', rough: 0.55 }), band = M(0xdca24a, { metal: 0.7, rough: 0.3, tex: 'plain', env: 1.1 });
    const lidG = new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24, 1, false, 0, Math.PI); lidG.rotateZ(Math.PI / 2);
    const body = at(ext(shape(rrectPts(1.3, 0.62, 0.04)), 0.84, wood, 0.03, 2), 0, -0.3, 0), lid = at(mesh(lidG, wood), 0, 0.02, 0, 0, 0, 0, [1, 0.8, 1]);
    const bands = [-0.5, 0, 0.5].map((x) => grp(at(ext(shape(rrectPts(0.09, 0.64, 0.02)), 0.9, band, 0.015, 1), x, -0.3, 0), at(torus(0.43, 0.045, band, Math.PI, 6, 24), x, 0.02, 0, 0, Math.PI / 2, 0, [1, 0.8, 1])));
    const rimB = at(ext(shape(rrectPts(1.36, 0.08, 0.02)), 0.9, band, 0.015, 1), 0, 0.0, 0);
    const lock = grp(at(ext(shape(roundPoly([[-0.13, 0.12], [0.13, 0.12], [0.13, -0.08], [0, -0.2], [-0.13, -0.08]], 0.03)), 0.05, C.gold(), 0.02, 2), 0, -0.06, 0.45), at(ext(shape(circlePts(0.04, 12)), 0.02, C.ink(), 0.01, 1), 0, -0.04, 0.49));
    return grp(body, lid, ...bands, rimB, lock, at(acorn(0.56, 0.5), 0.6, -0.56, 0.56), at(acorn(0.5, -0.6), -0.54, -0.62, 0.56));
  }, yaw: 0.45, pitch: 0.3 },
  coin_vault: { make: () => { const chest = ICONS.coin_chest.make() as THREE.Group; return grp(at(chest, 0.3, -0.1, 0, 0, 0, 0, 0.92), at(acornBag({ spill: 0 }), -0.78, 0.0, -0.3, 0, 0.3, 0, 0.62), at(moonGem(), 0.95, -0.55, 0.55, 0.2, 0, -0.3, 0.36), at(acorn(0.6, 0.6), -0.55, -0.62, 0.55)); }, yaw: 0.35, pitch: 0.26 },
  moongem: { make: () => moonGem9(), yaw: 0.3, pitch: 0.32 },
  // [icons9] the Outside / Inside tile: a round door, shut; ajar with warm light inside
  door_out: { make: () => roundDoor(false), yaw: 0.18, pitch: 0.1 },
  door_in: { make: () => roundDoor(true), yaw: 0.3, pitch: 0.1 },
};
function hanger(): O {
  return grp(tube([[-0.9, -0.4, 0], [-0.4, -0.12, 0], [0, 0.12, 0], [0.4, -0.12, 0], [0.9, -0.4, 0], [0.82, -0.5, 0], [-0.82, -0.5, 0], [-0.9, -0.4, 0]], 0.08, C.wood(), 64, 8), at(torus(0.2, 0.045, C.brass(), Math.PI * 1.3, 8, 24), 0.05, 0.42, 0, 0, 0, -0.6), at(cyl(0.045, 0.045, 0.14, C.brass(), 8), 0, 0.2, 0));
}
function gear(m: THREE.Material, teeth = 10, web?: THREE.Material): O {
  const pts: P2[] = [], N = teeth * 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, ph = ((a / (Math.PI * 2)) * teeth) % 1;
    const tooth = ph < 0.3 ? 1 : ph < 0.42 ? 1 - (ph - 0.3) / 0.12 : ph > 0.88 ? (ph - 0.88) / 0.12 : 0;
    pts.push([Math.cos(a) * (0.64 + 0.3 * tooth), Math.sin(a) * (0.64 + 0.3 * tooth)]);
  }
  const rim = shape(pts), inner = new THREE.Path();
  inner.absarc(0, 0, 0.47, 0, Math.PI * 2, true);
  rim.holes.push(inner);
  const w = web ?? m, g = grp(ext(rim, 0.22, m, 0.06, 3, 120));
  // four spokes from the hub to the rim, a domed hub, a steel axle
  for (let k = 0; k < 2; k++) g.add(at(ext(shape(rrectPts(0.17, 1.0, 0.04)), 0.12, w, 0.03, 2), 0, 0, -0.02, 0, 0, (k * Math.PI) / 2 + Math.PI / 4));
  g.add(at(lathe(smoothProfile([[0, 0.12], [0.12, 0.11], [0.2, 0.06], [0.22, 0], [0.2, -0.06], [0, -0.06]], 3), w, 32), 0, 0, 0.04, Math.PI / 2), at(cyl(0.08, 0.08, 0.32, C.steel(), 16), 0, 0, 0.04, Math.PI / 2));
  return g;
}
function sweater(col = 0x3a7a4c): O {
  const knit = M(col, { rough: 0.85, tex: 'knit', rep: 2 });
  const body = ext(shape([[-0.5, 0.62], [-0.18, 0.7], [0.18, 0.7], [0.5, 0.62], [0.95, 0.15], [0.78, -0.05], [0.5, 0.2], [0.48, -0.75], [-0.48, -0.75], [-0.5, 0.2], [-0.78, -0.05], [-0.95, 0.15]]), 0.28, knit, 0.12, 3);
  const collar = at(torus(0.2, 0.07, M(0xfff0cc, { rough: 0.8, tex: 'knit' }), Math.PI, 8, 20), 0, 0.68, 0.06, 0, 0, Math.PI);
  const hem = at(ext(shape(rrectPts(0.98, 0.14, 0.05)), 0.36, M(0xfff0cc, { rough: 0.8, tex: 'knit' }), 0.04, 2), 0, -0.72, 0);
  const heart = at(ext(shape(Array.from({ length: 40 }, (_, i) => { const t = (i / 40) * Math.PI * 2; return [(16 * Math.sin(t) ** 3) / 16 * 0.2, ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16) * 0.2] as P2; })), 0.04, M(0xfff0cc, { rough: 0.7, tex: null }), 0.02, 1), 0, 0.02, 0.22);
  return grp(body, collar, hem, heart);
}
function speaker(): O {
  return grp(at(ext(shape(rrectPts(0.36, 0.62, 0.08)), 0.46, C.brass(), 0.05, 2), -0.55, 0, 0), at(lathe(smoothProfile([[0.16, 0], [0.24, 0.2], [0.5, 0.48], [0.56, 0.52], [0.5, 0.54], [0.2, 0.25], [0.12, 0.02]], 2), C.brass(), 32), -0.42, 0, 0, 0, 0, -Math.PI / 2), at(cyl(0.48, 0.48, 0.04, M(0x5a3a28, { tex: 'weave' }), 32), 0.08, 0, 0, 0, 0, Math.PI / 2));
}
const texCache = new Map<string, THREE.Texture>();
function mapTex(): THREE.Texture {
  const hit = texCache.get('map'); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4e2b4'; g.fillRect(0, 0, 96, 64);
  g.fillStyle = '#7cc0e8'; g.beginPath(); g.ellipse(70, 20, 22, 14, 0.3, 0, 7); g.fill();
  g.fillStyle = '#8fcf6a'; for (const [x, y, r] of [[22, 40, 14], [40, 16, 10], [60, 48, 12]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = '#4a9a48'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(10 + (i * 37) % 80, 8 + (i * 23) % 50, 3, 0, 7); g.fill(); }
  g.strokeStyle = '#d23a3a'; g.lineWidth = 2.4; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(8, 56); g.bezierCurveTo(30, 30, 50, 60, 84, 12); g.stroke();
  g.setLineDash([]); g.lineWidth = 3; g.beginPath(); g.moveTo(80, 8); g.lineTo(88, 16); g.moveTo(88, 8); g.lineTo(80, 16); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('map', t); return t;
}
function stripeTex(cols?: string[], widths?: number[], vertical = false): THREE.Texture {
  const key = 'st' + JSON.stringify([cols, widths, vertical]), hit = texCache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  if (!cols) {
    g.fillStyle = '#f2b4c4'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#d24a6a'; for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 3, 32);
    g.fillStyle = '#fff6da'; for (let y = 4; y < 32; y += 10) for (let x = 5; x < 32; x += 8) g.fillRect(x, y, 2, 2);
  } else {
    const tot = (widths ?? cols.map(() => 1)).reduce((a, b) => a + b, 0);
    let x = 0;
    cols.forEach((col, i) => { const w = ((widths?.[i] ?? 1) / tot) * 32; g.fillStyle = col; if (vertical) g.fillRect(x, 0, w + 0.5, 32); else g.fillRect(0, x, 32, w + 0.5); x += w; });
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(cols ? (vertical ? 1 : 4) : 2, cols ? (vertical ? 1 : 4) : 3); texCache.set(key, t); return t;
}
function ringTex(): THREE.Texture {
  const hit = texCache.get('ring'); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const cols = ['#a83a32', '#efdcb8', '#5a8a4a', '#d6a040', '#3a5a9a', '#efdcb8', '#a83a32'];
  for (let i = 0; i < cols.length; i++) { g.fillStyle = cols[i]; g.beginPath(); g.arc(32, 32, 32 - i * 4.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('ring', t); return t;
}


// ------------------------------------------------------------------ framing and the painted finish
/** the projected bounds (camera space) of the model's visible vertices */
function projBounds(obj: O): THREE.Box3 {
  const pb = new THREE.Box3(), v = new THREE.Vector3();
  obj.traverse((m) => {
    const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g?.attributes?.position || !m.visible) return;
    let vis = true;
    m.traverseAncestors((a) => { if (!a.visible) vis = false; });
    if (!vis) return;
    const p = g.attributes.position as THREE.BufferAttribute, step = Math.max(1, Math.floor(p.count / 3000));
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(cam.matrixWorldInverse); pb.expandByPoint(v); }
  });
  return pb;
}
/** point the camera at the model from (yaw, pitch); returns its bounding sphere */
function aim(obj: O, yaw: number, pitch: number): THREE.Sphere {
  obj.updateMatrixWorld(true);
  const sph = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.position.copy(sph.center).addScaledVector(dir, sph.radius * 4);
  cam.up.set(0, 1, 0);
  cam.lookAt(sph.center);
  cam.updateMatrixWorld();
  cam.near = sph.radius * 2.9; cam.far = sph.radius * 5.1;
  return sph;
}
/**
 * Frame the model for an `n` px icon: fitted to its projected outline with `margin` px kept round it for the outline;
 * `pad` > 1 draws it smaller.
 */
function frameIcon(obj: O, n: number, yaw: number, pitch: number, pad = 1, margin = 3): THREE.Sphere {
  const sph = aim(obj, yaw, pitch);
  const pb = projBounds(obj);
  const inner = n - margin * 2, upp = (Math.max(pb.max.x - pb.min.x, pb.max.y - pb.min.y) * pad) / inner;
  const mx = (pb.max.x + pb.min.x) / 2, my = (pb.max.y + pb.min.y) / 2;
  cam.left = mx - (n / 2) * upp; cam.right = cam.left + n * upp;
  cam.top = my + (n / 2) * upp; cam.bottom = cam.top - n * upp;
  cam.updateProjectionMatrix();
  return sph;
}
type Finish = { lineDepth?: number };
/**
 * [icons9] Every icon is drawn at 256 px and drawn smoothly down to whatever size the screen wants. [name, px, edge px,
 * ink px, samples per px]
 */
const SIZES = [['hd', 256, 1.4, 0, 2]] as const;
type SizeName = (typeof SIZES)[number][0];
type Arts = Record<SizeName, Art>;
/** one icon at every size, with its painted highlights */
async function bakeIcon(sp: Spec, obj?: O): Promise<Arts> {
  obj ??= prep(await sp.make());
  const res = {} as Arts;
  for (const [name, n, outline, ink, ss] of SIZES) {
    const sph = frameIcon(obj, n, sp.yaw ?? 0.5, sp.pitch ?? 0.3, sp.pad ?? 1, outline + 6);
    res[name] = paintFinish(passes(obj, n, n, ss, sph.center, sph.radius), { groups: groupOf, outline, outlineAlpha: sp.edge ?? 0.35, ink, lineDepth: sp.fin?.lineDepth ?? 0.045 });
  }
  return res;
}

// ------------------------------------------------------------------ painted touches: highlights, the idle frames' glints and twinkles
const artCanvas = (a: Art): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = a.w; c.height = a.h; c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(a.d), a.w, a.h), 0, 0); return c; };
const toArt = (c: HTMLCanvasElement, g?: Int32Array): Art => ({ w: c.width, h: c.height, d: c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data, g });
const cloneArt = (a: Art): Art => ({ w: a.w, h: a.h, d: new Uint8ClampedArray(a.d), g: a.g });
/** is this pixel one of a glossy material's (nut, gem, gold, glass)? */
const glossyAt = (a: Art, i: number) => { const g = a.g?.[i] ?? -1; return g >= 0 && !!groupOf(g).glossy; };
/** a canvas whose alpha is the pixels `pick` keeps */
function maskOf(a: Art, pick: (i: number) => boolean): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
  const g = c.getContext('2d')!, im = g.createImageData(a.w, a.h);
  for (let i = 0; i < a.w * a.h; i++) if (pick(i)) { im.data[i * 4 + 3] = Math.min(255, a.d[i * 4 + 3] * 1.1); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; }
  g.putImageData(im, 0, 0);
  return c;
}
/** lay `paint` (drawn on a scratch canvas) over the art, kept to the mask, with `op` */
function layOn(c: HTMLCanvasElement, mask: HTMLCanvasElement, op: GlobalCompositeOperation, paint: (g: CanvasRenderingContext2D) => void) {
  const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
  const tg = t.getContext('2d')!;
  paint(tg);
  tg.globalCompositeOperation = 'destination-in';
  tg.drawImage(mask, 0, 0);
  const g = c.getContext('2d')!;
  g.save(); g.globalCompositeOperation = op; g.drawImage(t, 0, 0); g.restore();
}
/** [icons9] a soft band of light sweeping across the glossy parts only (the nut, not its scaly cup or the leaf); `pos` 0..1 across, < 0 none */
function glintArt(a: Art, pos: number): Art {
  if (pos < 0) return cloneArt(a);
  const c = artCanvas(a), mask = maskOf(a, (i) => glossyAt(a, i));
  const x = (pos * 1.8 - 0.4) * a.w, w = a.w * 0.09;
  layOn(c, mask, 'screen', (t) => {
    t.translate(x, a.h / 2); t.rotate(0.5);
    const gr = t.createLinearGradient(-w, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,248,226,0)'); gr.addColorStop(0.5, 'rgba(255,250,236,0.75)'); gr.addColorStop(1, 'rgba(255,248,226,0)');
    t.fillStyle = gr; t.fillRect(-w, -a.h, w * 2, a.h * 2);
  });
  return toArt(c, a.g);
}
/** a four-point twinkle at (x, y), arms `r` px long: slim rays with a soft glow and a bright core */
function sparkleArt(a: Art, x: number, y: number, r: number, col: string): Art {
  const c = artCanvas(a), g = c.getContext('2d')!;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const glow = g.createRadialGradient(x, y, 0, x, y, r * 0.7);
  glow.addColorStop(0, `rgba(${col},0.55)`); glow.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 0.7, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,250,0.95)';
  const w = Math.max(0.7, r * 0.12);
  for (const [dx, dy] of [[1, 0], [0, 1]]) { g.beginPath(); g.moveTo(x - dx * r, y - dy * r); g.lineTo(x + dy * w, y + dx * w); g.lineTo(x + dx * r, y + dy * r); g.lineTo(x - dy * w, y - dx * w); g.closePath(); g.fill(); }
  g.restore();
  return toArt(c, a.g);
}
/** the brightest glossy pixels inside the sprite (where twinkles go), brightest first, spread apart */
function twinkleSpots(a: Art, n: number): [number, number][] {
  const c: [number, number, number][] = [];
  for (let y = 1; y < a.h - 1; y++) for (let x = 1; x < a.w - 1; x++) {
    const i = y * a.w + x, j = i * 4;
    if (!glossyAt(a, i) || a.d[j + 3] < 250) continue;
    c.push([x, y, a.d[j] * 0.3 + a.d[j + 1] * 0.59 + a.d[j + 2] * 0.11]);
  }
  c.sort((p, q) => q[2] - p[2]);
  const out: [number, number][] = [], gap = a.w / 5;
  for (const [x, y] of c) { if (out.length >= n) break; if (out.every(([px, py]) => Math.hypot(px - x, py - y) > gap)) out.push([x, y]); }
  return out;
}

// ------------------------------------------------------------------ the shelf's sprites (the main buttons, in 2D)
/**
 * The main buttons' shelf, painted from the 3D props: the carved walnut shelf with its brass name plates, the oil lamp
 * (its flame at four strengths, out, and flaring as the wick wheel turns), the cuckoo clock (its door shut,
 * ajar, open with the owl out, and the owl calling; the pendulum separately at five swings; the hands are drawn live
 * over the dial) and the journal (shut, peeking, unbuckled, opening, open). Positions are in art px, one per CSS px of
 * the shelf's box (352 x 178, the nav's 352 x 132 and 46 above it), the sprites drawn at SHELF_RES px per art px, all
 * seen through one orthographic camera looking a little down at the shelf so every sprite lines up.
 */
const SHELF_BOX = { w: 352, h: 178, top: 46 };
/** world units per art pixel */
const SU = 0.0262;
const SHELF_PITCH = (9 * Math.PI) / 180;
/** the objects' centres (art px) and how they stand on the shelf */
const SHELF_OBJ = { sleep: { cx: 60, s: 1.34, ry: 0.35 }, clock: { cx: 176, s: 1.1, ry: -0.08 }, book: { cx: 292, s: 1.1, ry: 0.42 } };
const SHELF_Z = -0.16;
let shelfTop = 0;
/** the shelf camera: pitched down, framing the art rect (x, y, w, h) of the shelf's box */
function shelfCam(x = 0, y = 0, w = SHELF_BOX.w, h = SHELF_BOX.h) {
  cam.position.set(0, Math.sin(SHELF_PITCH) * 20, Math.cos(SHELF_PITCH) * 20);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  // the shelf's front top edge (z = 0.3, y = 0) sits at art y = 100 + 46 (where the nav's plates expect it)
  const v = new THREE.Vector3(0, 0, 0.3).applyMatrix4(cam.matrixWorldInverse);
  shelfTop = v.y + 146 * SU;
  cam.left = (-SHELF_BOX.w / 2 + x) * SU; cam.right = cam.left + w * SU;
  cam.top = shelfTop - y * SU; cam.bottom = cam.top - h * SU;
  cam.near = 20 - 3; cam.far = 20 + 3;
  cam.updateProjectionMatrix();
}
/** a world point's art position in the shelf's box */
function shelfPx(p: THREE.Vector3): [number, number] {
  shelfCam();
  const v = p.clone().applyMatrix4(cam.matrixWorldInverse);
  return [v.x / SU + SHELF_BOX.w / 2, (shelfTop - v.y) / SU];
}
/** the art rect a model covers (with a margin for its outline), whole pixels */
function shelfRect(objs: O[], margin = 3): [number, number, number, number] {
  shelfCam();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const o of objs) {
    o.updateMatrixWorld(true);
    const pb = projBounds(o);
    x0 = Math.min(x0, pb.min.x / SU + SHELF_BOX.w / 2); x1 = Math.max(x1, pb.max.x / SU + SHELF_BOX.w / 2);
    y0 = Math.min(y0, (shelfTop - pb.max.y) / SU); y1 = Math.max(y1, (shelfTop - pb.min.y) / SU);
  }
  const x = Math.floor(x0) - margin, y = Math.floor(y0) - margin;
  return [x, y, Math.ceil(x1) + margin - x, Math.ceil(y1) + margin - y];
}
interface ShelfSprite { name: string; art: Art; x: number; y: number }
/** [icons9] the shelf's sprites are drawn at this many px per art px (one art px is one CSS px of the shelf's box) */
const SHELF_RES = 3;
function shootShelf(name: string, obj: O, r: [number, number, number, number], fin: { lineDepth?: number } = {}): ShelfSprite {
  shelfCam(...r);
  const P = passes(obj, r[2] * SHELF_RES, r[3] * SHELF_RES, 2, new THREE.Vector3(obj.position.x, 1, 0), 2.2);
  // a faint dark edge, half a CSS pixel
  return { name, art: paintFinish(P, { groups: groupOf, outline: SHELF_RES * 0.5, outlineAlpha: 0.3, ink: 0, lineDepth: fin.lineDepth ?? 0.09 / (cam.far - cam.near) }), x: r[0], y: r[1] };
}
/** put a prop on the shelf where the live one stood */
function onShelf(root: O, id: keyof typeof SHELF_OBJ): O {
  const o = SHELF_OBJ[id];
  root.position.set((o.cx - SHELF_BOX.w / 2) * SU, 0, SHELF_Z);
  root.rotation.set(0, o.ry, 0);
  root.scale.setScalar(o.s);
  return root;
}
async function bakeShelf(): Promise<{ sprites: ShelfSprite[]; dial: [number, number, number]; lampAt: [number, number] }> {
  const out: ShelfSprite[] = [];
  // the shelf: walnut, carved rosettes between brass name plates, two acorns and an oak leaf by the lamp
  shelfCam();
  const plateY = -(163 - 146) * SU / Math.cos(SHELF_PITCH);
  const plates = (['sleep', 'clock', 'book'] as const).map((id) => ({ x: (SHELF_OBJ[id].cx - SHELF_BOX.w / 2) * SU, y: plateY, w: 88 * SU, h: 18 * SU }));
  const sh = shelf(344 * SU, { plates, bosses: [118, 234].map((x) => (x - SHELF_BOX.w / 2) * SU) });
  const a1 = acornProp(0.62), a2 = acornProp(0.55), leaf = oakLeafProp(0.9), gx = (SHELF_OBJ.sleep.cx + 56 - SHELF_BOX.w / 2) * SU;
  a1.position.set(gx - 0.08, 0.13, 0.08); a1.rotation.set(0.2, 0.6, Math.PI / 2 - 0.15);
  a2.position.set(gx + 0.26, 0.17, -0.2); a2.rotation.set(0, -0.4, 0.1);
  leaf.position.set(gx + 0.1, 0.012, 0.02); leaf.rotation.set(-Math.PI / 2 + 0.06, 0, 0.9);
  // the plates a softer brass than the live one's mirror polish, so their names read in dark ink on a light ground
  const plateM = (sh.plates[0].material as THREE.MeshStandardMaterial).clone();
  Object.assign(plateM, { metalness: 0.3, roughness: 0.42, envMapIntensity: 0.6 });
  plateM.color.setScalar(1.12);
  plateM.userData.pix = { glossy: false };
  for (const p of sh.plates) p.material = plateM;
  void leaf;
  const shelfG = grp(sh.root, a1, a2);
  out.push(shootShelf('shelf', shelfG, [-4, 124, SHELF_BOX.w + 8, SHELF_BOX.h - 124], { lineDepth: 0.05 / 6 }));
  // [icons9] the oil lamp: its flame at four strengths, out, and flaring as the wick wheel is turned up
  const lamp = oilLamp();
  lamp.root.getObjectByName('halo')!.visible = false;
  onShelf(lamp.root, 'sleep');
  lamp.setGlow(1.6);
  const lr = shelfRect([lamp.root]);
  for (const [n, g, turn] of [['lamp0', 0.55, 0], ['lamp1', 0.8, 0], ['lamp2', 1.05, 0], ['lamp3', 1.3, 0], ['lamp_off', 0.04, -0.6], ['lamp_pull', 1.6, 0.9]] as [string, number, number][]) {
    lamp.setGlow(g);
    lamp.knob.rotation.x = turn;
    out.push(shootShelf(n, lamp.root, lr));
  }
  lamp.knob.rotation.x = 0;
  const lampAt = shelfPx(lamp.root.localToWorld(lamp.flameAt.clone()));
  // [clock12] the cuckoo clock: the loading screen's own painting (onboard/clockpaint.ts) standing on a little walnut
  // plinth with turned posts, its weights hanging short between them; the body (no pendulum, no hands) with its door
  // and owl, then the pendulum on its own (cut wherever the body is in front of it)
  const { sprites: clockSprites, dial } = bakeShelfClock();
  out.push(...clockSprites);
  // the journal: shut, peeking, unbuckled, opening, open
  const book = journal();
  onShelf(book.root, 'book');
  book.cover.rotation.y = -1.45; book.tab.rotation.y = 2.4;
  const br0 = shelfRect([book.root]);
  book.cover.rotation.y = 0; book.tab.rotation.y = 0;
  const br1 = shelfRect([book.root]);
  const br: [number, number, number, number] = [Math.min(br0[0], br1[0]), Math.min(br0[1], br1[1]), 0, 0];
  br[2] = Math.max(br0[0] + br0[2], br1[0] + br1[2]) - br[0]; br[3] = Math.max(br0[1] + br0[3], br1[1] + br1[3]) - br[1];
  for (const [n, cov, tab] of [['book0', 0, 0], ['book1', 0.2, 0.25], ['book2', 0.05, 2.4], ['book3', 0.6, 2.4], ['book4', 1.05, 2.4], ['book5', 1.45, 2.4]] as [string, number, number][]) {
    book.cover.rotation.y = -cov; book.tab.rotation.y = tab;
    out.push(shootShelf(n, book.root, br));
  }
  return { sprites: out, dial, lampAt };
}
/** [clock12] the shelf's clock: art px per art unit of the painting, and where its plinth sits */
const CLOCK_K = 0.37, CLOCK_PLINTH = 286, CLOCK_FOOT = 146;
function bakeShelfClock(): { sprites: ShelfSprite[]; dial: [number, number, number] } {
  const cx = SHELF_OBJ.clock.cx, R = SHELF_RES * CLOCK_K;
  // the painting's box (art units) -> the shelf's box (art px), on whole art px
  const u0 = CP.CASE_BOX.x, u1 = CP.CASE_BOX.x + CP.CASE_BOX.w, v0 = 8, v1 = CLOCK_PLINTH + 9;
  const bx = Math.floor(cx + (u0 - CP.CX) * CLOCK_K), by = Math.floor(CLOCK_FOOT - (v1 - v0) * CLOCK_K);
  const bw = Math.ceil((u1 - u0) * CLOCK_K) + 1, bh = CLOCK_FOOT - by;
  const ux = CP.CX + (bx - cx) / CLOCK_K, uy = v1 - (CLOCK_FOOT - by) / CLOCK_K, uw = bw / CLOCK_K, uh = bh / CLOCK_K;
  const loop = 238, ringY = 248;
  const body = (door: CP.DoorState, owl: CP.OwlPose | null) => {
    const [c, g] = CP.layer(ux, uy, uw, uh, R);
    CP.paintStand(g, CLOCK_PLINTH);
    for (const sd of [-1, 1]) {
      CP.paintChain(g, CP.CX + sd * CP.G.rx, CP.G.chainTop, ringY - 2.6); CP.paintRing(g, CP.CX + sd * CP.G.rx, ringY);
      CP.paintChain(g, CP.CX + sd * CP.G.wx, CP.G.chainTop, loop + 0.5); CP.paintCone(g, CP.CX + sd * CP.G.wx, loop);
    }
    CP.paintCase(g, { door, owl });
    return CP.finish(c, R, 1.15);
  };
  const out: ShelfSprite[] = [];
  let closed: HTMLCanvasElement | null = null;
  for (const [n, door, owl] of [['clock0', 'closed', null], ['clock1', 'ajar', 'peek'], ['clock2', 'open', 'out'], ['clock3', 'open', 'bow']] as [string, CP.DoorState, CP.OwlPose | null][]) {
    const c = body(door, owl);
    if (!closed) closed = c;
    out.push({ name: n, art: toArt(c), x: bx, y: by });
  }
  // the pendulum at five angles, behind the body
  const len = 34;
  for (const [i, a] of [-0.26, -0.13, 0, 0.13, 0.26].entries()) {
    const [c, g] = CP.layer(ux, uy, uw, uh, R);
    g.translate(CP.CX, CP.G.pivot.y); g.rotate(a); g.translate(-CP.CX, -CP.G.pivot.y);
    CP.paintPendulum(g, len);
    const f = CP.finish(c, R, 1);
    const fg = f.getContext('2d')!;
    fg.globalCompositeOperation = 'destination-out';
    fg.drawImage(closed!, 0, 0);
    out.push({ name: 'pend' + i, art: toArt(f), x: bx, y: by });
  }
  const dial: [number, number, number] = [cx, by + (CP.G.dial.y - uy) * CLOCK_K, CP.G.dial.r * CLOCK_K];
  return { sprites: out, dial };
}
// ------------------------------------------------------------------ the bake
/** the currency's idle frames: [name, model, frames]; acorn_big and gem_big are the same frames, drawn bigger */
const ANIM: [string, string, number][] = [['owlcoin', 'owlcoin', 8], ['moongem', 'moongem', 8], ['coin_vault', 'coin_vault', 4]];
const ANIM_ALIAS: Record<string, string> = { acorn_big: 'owlcoin', gem_big: 'moongem' };
/** names that share a model */
const ALIAS: Record<string, string> = { acorn: 'owlcoin', wd_hanger: 'hanger' };

/** the photo swatches the models' wood, leather and cloth wear (prepared from Poly Haven CC0 textures in art/tex7) */
async function loadPhotos(): Promise<void> {
  await Promise.all(SWATCHES.map((n) => new Promise<void>((res) => {
    const im = new Image();
    im.onload = () => { setSwatch(n, im, [0, 0, im.width, im.height]); res(); };
    im.onerror = () => res();
    im.src = `/art/tex7/${n}.webp`;
  })));
}

const host = document.getElementById('out')!;
function show(name: string, r: Arts) {
  const fig = document.createElement('figure');
  const row = document.createElement('div');
  row.className = 'row';
  const add = (a: Art, w: number, cls = '') => { const c = artCanvas(a); c.style.width = `${w}px`; c.className = cls; row.appendChild(c); };
  add(r.hd, 128); add(r.hd, 88); add(r.hd, 44, 'one'); add(r.hd, 30, 'one'); add(r.hd, 20, 'one'); add(r.hd, 88, 'dark'); add(r.hd, 30, 'dark');
  fig.append(row, Object.assign(document.createElement('figcaption'), { textContent: name }));
  host.appendChild(fig);
}

async function bake() {
  const only = q.get('only');
  await loadPhotos();
  carvedOak().color.setRGB(0.8, 0.66, 0.52); // the cuckoo clocks' carved oak leaves: carving, not polka dots
  const test = (n: string) => !only || new RegExp(only).test(n);
  const cells: Arts[] = [];
  const icons: Record<string, number> = {}, anim: Record<string, number[]> = {};
  const push = (r: Arts) => { cells.push(r); return cells.length - 1; };
  const models = new Map<string, O>();
  for (const name of Object.keys(ICONS).filter(test)) {
    try {
      const obj = prep(await ICONS[name].make());
      models.set(name, obj);
      const r = await bakeIcon(ICONS[name], obj);
      icons[name] = push(r);
      show(name, r);
    } catch (e) { console.error('bake failed', name, e); }
  }
  for (const [a, b] of Object.entries(ALIAS)) if (icons[b] !== undefined && test(a)) icons[a] = icons[b];
  // [icons9] the currency's idle frames: a soft band of light sweeps across the acorn's gloss and a twinkle comes and
  // goes; the gem's facets flash in turn as the light swings round it (each frame rendered), with twinkles on its
  // brightest facets; the vault twinkles
  for (const [name, model, frames] of ANIM) {
    if (!test(name) || icons[model] === undefined) continue;
    const base = cells[icons[model]];
    const list: number[] = [];
    for (let f = 0; f < frames; f++) {
      let src = base;
      if (model === 'moongem') { lightSwing = Math.sin((f / frames) * Math.PI * 2) * 0.8; src = await bakeIcon(ICONS[model], models.get(model)); lightSwing = 0; }
      const r = {} as Arts;
      for (const [sz] of SIZES) {
        const a = src[sz], arm = a.w * 0.08;
        let o = model === 'owlcoin' ? glintArt(a, [-1, -1, 0.05, 0.3, 0.55, 0.8, 1.05, -1][f]) : cloneArt(a);
        const spots = twinkleSpots(a, 4);
        const want = model === 'owlcoin' ? (f === 1 || f === 6 ? [spots[0]] : []) : model === 'moongem' ? (f % 2 === 0 ? [spots[(f / 2) % Math.max(1, spots.length)]] : []) : [spots[f % Math.max(1, spots.length)]];
        for (const p of want) if (p) o = sparkleArt(o, p[0], p[1], arm * (model === 'moongem' && f % 4 === 2 ? 0.75 : 1), model === 'moongem' ? '226,210,255' : '255,232,170');
        r[sz] = o;
      }
      list.push(push(r));
      if (f === 3 || f === 6) show(`${name}_f${f}`, r);
    }
    anim[name] = list;
  }
  for (const [a, b] of Object.entries(ANIM_ALIAS)) if (anim[b]) anim[a] = anim[b];
  // the shelf's sprites
  const sh = test('shelf') ? await bakeShelf() : null;
  if (sh) for (const sp of sh.sprites) {
    const fig = document.createElement('figure'), c = artCanvas(sp.art);
    c.style.width = `${sp.art.w}px`;
    fig.append(c, Object.assign(document.createElement('figcaption'), { textContent: `${sp.name} ${sp.x},${sp.y}` }));
    host.appendChild(fig);
  }
  const w = window as unknown as { __module: string; __atlas: string; __shelfAtlas: string; __done: boolean };
  document.title = 'baked ' + Object.keys(icons).length;
  // the shelf's atlas: its sprites packed in rows (tallest first), 2 px apart
  const packShelf = () => {
    const SW = 2048, sprites: Record<string, [number, number, number, number, number, number]> = {};
    let px = 0, py = 0, rowH = 0;
    for (const sp of [...(sh?.sprites ?? [])].sort((a, b) => b.art.h - a.art.h)) {
      if (px + sp.art.w > SW) { px = 0; py += rowH + 2; rowH = 0; }
      sprites[sp.name] = [px, py, sp.art.w, sp.art.h, sp.x, sp.y];
      px += sp.art.w + 2; rowH = Math.max(rowH, sp.art.h);
    }
    const shelfAtlas = document.createElement('canvas');
    shelfAtlas.width = SW; shelfAtlas.height = Math.max(1, py + rowH);
    const sg = shelfAtlas.getContext('2d')!;
    for (const sp of sh?.sprites ?? []) { const r = sprites[sp.name]; sg.putImageData(new ImageData(new Uint8ClampedArray(sp.art.d), sp.art.w, sp.art.h), r[0], r[1]); }
    const shelfIdx = { atlas: 'img/ui3d-shelf.webp', res: SHELF_RES, box: [SHELF_BOX.w, SHELF_BOX.h, SHELF_BOX.top], sprites, dial: sh?.dial.map((v) => +v.toFixed(2)) ?? [0, 0, 0], lamp: sh?.lampAt.map((v) => +v.toFixed(1)) ?? [0, 0], objects: Object.fromEntries(Object.entries(SHELF_OBJ).map(([k, v]) => [k, v.cx])) };
    return { shelfAtlas, shelfIdx };
  };
  // [clock12] ?only=shelf&shelfonly=1: re-bake the shelf's atlas alone, keeping the icons' atlas and index as they are
  if (only && q.get('shelfonly') && sh) {
    const { shelfAtlas, shelfIdx } = packShelf();
    w.__module = moduleText(JSON.stringify({ atlas: ICONS3D.atlas, hd: ICONS3D.hd, icons: ICONS3D.icons, anim: ICONS3D.anim, shelf: shelfIdx }));
    w.__shelfAtlas = shelfAtlas.toDataURL('image/png');
    w.__done = true;
    return;
  }
  if (only) { w.__done = true; return; }
  // the icons' atlas: the 256 px drawings, 16 to a row
  const AW = 4096, grids = {} as Record<SizeName, [number, number, number]>;
  let y = 0;
  for (const [sz, n] of SIZES) { const cols = Math.floor(AW / n); grids[sz] = [n, cols, y]; y += Math.ceil(cells.length / cols) * n; }
  const atlas = document.createElement('canvas');
  atlas.width = AW; atlas.height = y;
  const ag = atlas.getContext('2d')!;
  for (const [sz, n] of SIZES) { const [, cols, y0] = grids[sz]; cells.forEach((c, i) => ag.putImageData(new ImageData(new Uint8ClampedArray(c[sz].d), n, n), (i % cols) * n, y0 + Math.floor(i / cols) * n)); }
  const { shelfAtlas, shelfIdx } = packShelf();
  const json = JSON.stringify({ atlas: 'img/ui3d.webp', hd: grids.hd, icons, anim, shelf: shelfIdx });
  w.__module = moduleText(json);
  w.__atlas = atlas.toDataURL('image/png');
  w.__shelfAtlas = shelfAtlas.toDataURL('image/png');
  w.__done = true;
}
function moduleText(json: string): string {
  return `// GENERATED by src/dev/iconbake.ts (/dev-iconbake.html; a tools script writes window.__module here, window.__atlas to
// public/img/ui3d.webp and window.__shelfAtlas to public/img/ui3d-shelf.webp): the interface atlases' index. Every
// interface icon is a detailed 3D model rendered realistically with its real textures at 256 px ("hd"). { atlas, hd: [px,
// cells per row, y of the first row], icons: { name: cell }, anim: { name: [cells] }, shelf: the main buttons' sprites { atlas, res: px per
// art px, box: [w, h, how far above the nav] in art px, sprites: { name: [atlas x, y, w, h (atlas px), x, y in the box
// (art px)] }, dial: [x, y, radius], lamp: [x, y] of the flame, objects: { id: centre x } } }. Models: the game's own
// GLBs, the shelf's props (src/ui/chrome/props3d.ts) and models made in the bake; credits in docs/credits.
export interface ShelfIndex { atlas: string; res: number; box: [number, number, number]; sprites: Record<string, [number, number, number, number, number, number]>; dial: [number, number, number]; lamp: [number, number]; objects: Record<string, number> }
export const ICONS3D: { atlas: string; hd: [number, number, number]; icons: Record<string, number>; anim: Record<string, number[]>; shelf: ShelfIndex } = ${json};
`;
}
void bake();
