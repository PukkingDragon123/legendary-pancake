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
import { bark, cloth, cloudTex, enamel, fitUV, flame, gem, glass, keepUV, leafTex, leather, metal, paper, scales, setSwatch, stone, swatchAt, SWATCHES, water, wax, wood, type Painted, type Swatch } from '../ui/chrome/paint3d.ts';
import {
  acornProp, at, carvedOak, oakLeafProp, ribbon, ball, circlePts, crescentPts, cuckooClock, cyl, ext, grp, journal, lathe, mesh, oilLamp, paintTex, planarUV, rrectPts, setClockHands, shape, shelf, smoothProfile, starPts, studioEnv, torus, tube,
  type O,
} from '../ui/chrome/props3d.ts';
import { paintFinish, type Art, type Group, type Passes } from './paintfinish.ts';

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
const goldStar = (R: number, r: number, n = 5, m: THREE.Material = C.gold()) => facetSolid(starPts(R, r, n), R * 0.32, R * 0.16, m);
const HEART: P2[] = Array.from({ length: 72 }, (_, i) => { const t = (i / 72) * Math.PI * 2; return [(16 * Math.sin(t) ** 3) / 16 * 0.9, ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16) * 0.9 + 0.1] as P2; });
/** an arrow pointing right (rotate it for the others), its corners softened */
const ARROW: P2[] = roundPoly([[-0.82, -0.2], [0.06, -0.2], [0.06, -0.56], [0.84, 0], [0.06, 0.56], [0.06, 0.2], [-0.82, 0.2]], 0.07);
const rot = (pts: P2[], a: number): P2[] => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const mirrorX = (pts: P2[]): P2[] => pts.map(([x, y]) => [-x, y] as P2).reverse();
/** a curved arrow round the centre (a refresh), clockwise when `cw` */
function curvedArrow(m: THREE.Material, cw: boolean): THREE.Group {
  const a0 = cw ? 2.2 : 0.94, a1 = cw ? -2.0 : 5.14, R = 0.64, n = 32, arc: P2[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; arc.push([Math.cos(a) * R, Math.sin(a) * R]); }
  const end = arc[n], tan = nrm(sub(arc[n], arc[n - 1])), nx = -tan[1], ny = tan[0];
  const head = roundPoly([[end[0] + nx * 0.29, end[1] + ny * 0.29], [end[0] + tan[0] * 0.34, end[1] + tan[1] * 0.34], [end[0] - nx * 0.29, end[1] - ny * 0.29]], 0.05);
  return grp(jewelStroke(arc.slice(0, n - 1), 0.21, m), jewel(head, m, { z: 0.03 }));
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

// ------------------------------------------------------------------ the icon models
type Make = () => O | Promise<O>;
interface Spec { make: Make; yaw?: number; pitch?: number; pad?: number; fin?: Finish }
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

const CHECK: P2[] = [[-0.72, 0.02], [-0.24, -0.46], [0.74, 0.6]];
const ICONS: Record<string, Spec> = {
  check: { make: () => jewelStroke(CHECK, 0.34, glaze(0x2f9457)), yaw: 0.28, pitch: 0.26 },
  cross: { make: () => grp(jewelStroke([[-0.6, -0.6], [0.6, 0.6]], 0.32, glaze(0xc0392f)), jewelStroke([[-0.6, 0.6], [0.6, -0.6]], 0.32, glaze(0xc0392f), { z: 0.03 })), yaw: 0.28, pitch: 0.26 },
  plus: { make: () => enamelButton(glaze(0x2f9457), [bar(0.86, 0.24), bar(0.24, 0.86)]), yaw: 0.26, pitch: 0.24 },
  minus: { make: () => enamelButton(glaze(0xc8506e), [bar(0.86, 0.24)]), yaw: 0.26, pitch: 0.24 },
  info: { make: () => enamelButton(glaze(0x3462a8), [circlePts(0.13, 24).map(([x, y]) => [x + 0.02, y + 0.4] as P2), roundPoly([[-0.18, 0.18], [0.1, 0.18], [0.1, -0.34], [0.2, -0.34], [0.2, -0.5], [-0.2, -0.5], [-0.2, -0.34], [-0.08, -0.34], [-0.08, 0.04], [-0.18, 0.04]], 0.03)]), yaw: 0.26, pitch: 0.24 },
  arrow_right: { make: () => jewel(ARROW, glaze(0x2f9457)), yaw: 0.28, pitch: 0.26 },
  arrow_left: { make: () => jewel(mirrorX(ARROW), glaze(0x2f9457)), yaw: 0.28, pitch: 0.26 },
  arrow_up: { make: () => jewel(rot(ARROW, Math.PI / 2), glaze(0x2f9457)), yaw: 0.28, pitch: 0.26 },
  arrow_down: { make: () => jewel(rot(ARROW, -Math.PI / 2), glaze(0xc8506e)), yaw: 0.28, pitch: 0.26 },
  rotate_right: { make: () => curvedArrow(glaze(0x4a8ac4), true), yaw: 0.26, pitch: 0.26 },
  rotate_left: { make: () => at(curvedArrow(glaze(0x4a8ac4), true), 0, 0, 0, 0, 0, 0, [-1, 1, 1]), yaw: -0.26, pitch: 0.26 }, // the mirror of rotate_right
  play: { make: () => jewel(roundPoly([[-0.44, -0.66], [0.72, 0], [-0.44, 0.66]], 0.16), glaze(0x2f9457)), yaw: 0.28, pitch: 0.24 },
  pause: { make: () => grp(jewel(bar(0.32, 1.12, -0.3), glaze(0x3462a8)), jewel(bar(0.32, 1.12, 0.3), glaze(0x3462a8))), yaw: 0.28, pitch: 0.24 },
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
  heart: { make: () => jewel(HEART, glaze(0xcc4060), { depth: 0.2, bevel: 0.16 }), yaw: 0.28, pitch: 0.26 },
  sparkle: { make: () => grp(goldStar(0.98, 0.26, 4), at(goldStar(0.34, 0.12, 4, M(0xfff0c0, { metal: 0.3, rough: 0.3, tex: null, glow: 0.25 })), 0.64, 0.62, 0.12)), yaw: 0.22, pitch: 0.22 },
  moon: { make: () => moonJewel(0.86, 0.72, [0.38, 0.22]), yaw: 0.28, pitch: 0.26 },
  sun: { make: () => { const g = grp(facetSolid(circlePts(0.52, 16), 0.16, 0.14, C.gold())); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(at(facetSolid([[-0.14, 0], [0.14, 0], [0, 0.34]], 0.08, 0.08, M(0xe89a38, { metal: 0.5, rough: 0.3, tex: null }), 0, 0.1), Math.cos(a) * 0.62, Math.sin(a) * 0.62, -0.02, 0, 0, a - Math.PI / 2)); } return g; }, yaw: 0.22, pitch: 0.22 },
  shield: { make: () => { const pts = roundPoly([[-0.7, 0.78], [0.7, 0.78], [0.7, 0.06], [0.48, -0.44], [0, -0.88], [-0.48, -0.44], [-0.7, 0.06]], 0.1); return grp(jewel(pts, glaze(0x3462a8), { rimM: M(0xd6a040, { metal: 0.65, rough: 0.3, tex: null }), rim: 0.1 }), at(goldStar(0.4, 0.18), 0, 0.06, 0.2)); }, yaw: 0.26, pitch: 0.24 },
  zzz: { make: () => { const Z = (s: number) => strokePts([[-0.45 * s, 0.4 * s], [0.42 * s, 0.4 * s], [-0.42 * s, -0.4 * s], [0.45 * s, -0.4 * s]], 0.17 * s, 6); const m = glaze(0x4a8ac4), r = C.silver(); return grp(at(jewel(Z(0.92), m, { rimM: r, rim: 0.05 }), -0.52, -0.48, 0), at(jewel(Z(0.64), m, { rimM: r, rim: 0.04 }), 0.2, 0.18, 0), at(jewel(Z(0.44), m, { rimM: r, rim: 0.035 }), 0.74, 0.72, 0)); }, yaw: 0.26, pitch: 0.2 },
  bolt: { make: () => jewel(roundPoly([[0.15, 0.95], [-0.55, -0.1], [-0.05, -0.1], [-0.25, -0.95], [0.55, 0.15], [0.05, 0.15]], 0.04), M(0xf0b632, { rough: 0.26, tex: 'plain', glow: 0.1 }), { rimM: M(0xb87a26, { metal: 0.6, rough: 0.35, tex: null }) }), yaw: 0.28, pitch: 0.26 },
  ice_flake: { make: () => { const ice = M(0x9ad2ee, { rough: 0.18, metal: 0.1, env: 1.2, tex: 'glass' }), g = grp(jewel(circlePts(0.16, 6), ice, { rim: 0, depth: 0.08, bevel: 0.05 })); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 2, c = Math.cos(a), s = Math.sin(a); g.add(strokeMesh([[c * 0.1, s * 0.1], [c * 0.92, s * 0.92]], 0.1, ice, 0.08, 0.035)); for (const fr of [0.48, 0.72]) { const px = c * fr, py = s * fr, l = fr < 0.6 ? 0.24 : 0.17; for (const sg of [-1, 1]) g.add(strokeMesh([[px, py], [px + Math.cos(a + sg * 0.75) * l, py + Math.sin(a + sg * 0.75) * l]], 0.08, ice, 0.07, 0.03)); } } return g; }, yaw: 0.24, pitch: 0.24 },
  alarm: { make: () => { const c = cuckooClock(); simpleDial(c.root); boldHands(c); setClockHands(c, new Date(2024, 0, 1, 7, 0, 0)); c.door.rotation.y = -2.1; c.owl.position.set(0, c.owl.position.y - 0.05, 0.5); c.owl.rotation.x = 0.2; c.owl.scale.setScalar(2.4); return c.root; }, yaw: 0.26, pitch: 0.12 },
  clock: { make: () => { const c = cuckooClock(); simpleDial(c.root); boldHands(c); setClockHands(c, new Date(2024, 0, 1, 10, 10, 0)); c.pendulum.rotation.z = 0.2; return c.root; }, yaw: 0.22, pitch: 0.1 },
  hourglass: {
    make: () => { const cap = (y: number, flip: number) => at(lathe(smoothProfile([[0, 0], [0.6, 0], [0.64, 0.05], [0.6, 0.1], [0.5, 0.12], [0, 0.12]], 2), C.wood(), 32), 0, y, 0, flip ? Math.PI : 0);
      return grp(cap(-0.9, 0), cap(0.9, 1), ...[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.5; return at(lathe(smoothProfile([[0.05, -0.8], [0.065, -0.4], [0.045, 0], [0.065, 0.4], [0.05, 0.8]], 2), C.dark(), 8), Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); }),
        lathe(smoothProfile([[0.4, -0.78], [0.44, -0.5], [0.3, -0.2], [0.07, 0], [0.3, 0.2], [0.44, 0.5], [0.4, 0.78]], 3), M(0xbfe8ff, { rough: 0.05, metal: 0.1, opacity: 0.45, tex: null, env: 1.6 }), 32),
        lathe(smoothProfile([[0, -0.77], [0.39, -0.76], [0.3, -0.5], [0.12, -0.34], [0, -0.3]], 2), M(0xf4c058, { rough: 0.8 }), 24), lathe([[0, 0.05], [0.16, 0.18], [0.28, 0.32], [0, 0.32]], M(0xf4c058, { rough: 0.8 }), 24), at(cyl(0.015, 0.015, 0.36, M(0xf4c058, { rough: 0.8 }), 6), 0, -0.14, 0)); }, yaw: 0.4, pitch: 0.2,
  },
  calendar: {
    make: () => { const red = hex('#d23a34'), ink = hex('#4a3a4a'), paper = hex('#fbf0d8');
      const tex = faceTex('cal', 32, 32, (x, y): RGB => { if (y > 24) return x > 3 && x < 28 && (y === 27 || y === 28) ? hex('#ffe9c0') : red; const col = Math.floor((x - 3) / 4), row = Math.floor((y - 3) / 5); if (x > 2 && x < 30 && y > 2 && y < 23 && (x - 3) % 4 < 3 && (y - 3) % 5 < 3) return col === 4 && row === 2 ? red : ink; return paper; });
      const pad = at(mesh(planarUV(new THREE.ExtrudeGeometry(shape(rrectPts(1.4, 1.4, 0.1)), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 })), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })), 0, -0.05, -0.08);
      return grp(pad, ...[-0.4, 0.4].map((x) => at(torus(0.12, 0.035, C.brass(), Math.PI * 2, 8, 20), x, 0.66, 0.06, 0, Math.PI / 2, 0))); }, yaw: 0.32, pitch: 0.24,
  },
  candle: {
    make: () => grp(lathe(smoothProfile([[0, -0.78], [0.6, -0.76], [0.66, -0.68], [0.62, -0.62], [0.24, -0.6], [0.22, -0.56], [0, -0.56]], 2), C.brass(), 40),
      at(lathe(smoothProfile([[0, -0.6], [0.25, -0.6], [0.26, 0.2], [0.24, 0.3], [0.1, 0.32], [0, 0.3]], 2), M(0xfff1d8, { rough: 0.55, tex: 'wax' }), 28), 0, 0, 0),
      tube([[0.22, 0.28, 0.12], [0.27, 0.12, 0.12], [0.27, -0.02, 0.1]], 0.04, M(0xfff1d8, { rough: 0.55, tex: 'wax' }), 8, 6),
      at(cyl(0.02, 0.02, 0.12, C.ink(), 6), 0, 0.38, 0),
      at(lathe(smoothProfile([[0, -0.2], [0.13, -0.1], [0.12, 0.05], [0.05, 0.2], [0, 0.3]], 2), C.flame(), 16), 0, 0.6, 0), at(lathe(smoothProfile([[0, -0.12], [0.06, -0.05], [0.04, 0.08], [0, 0.14]], 2), C.flameIn(), 12), 0, 0.56, 0.05),
      at(torus(0.16, 0.05, C.brass(), Math.PI, 8, 16), 0.64, -0.62, 0, 0, 0, -Math.PI / 2)), yaw: 0.4, pitch: 0.24,
  },
  lantern: {
    make: () => grp(at(lathe(smoothProfile([[0, 0], [0.52, 0], [0.56, 0.05], [0.5, 0.12], [0.4, 0.14], [0, 0.14]], 2), C.brass(), 32), 0, -0.8, 0),
      at(cyl(0.36, 0.36, 0.95, M(0xffd77a, { glow: 0.8, tex: null }), 24), 0, -0.18, 0),
      ...[0, 1, 2, 3].map((i) => at(cyl(0.045, 0.045, 1.0, C.brass(), 8), Math.cos(i * Math.PI / 2 + 0.6) * 0.4, -0.18, Math.sin(i * Math.PI / 2 + 0.6) * 0.4)),
      at(lathe(smoothProfile([[0.5, 0], [0.46, 0.08], [0.32, 0.2], [0.14, 0.3], [0.1, 0.36], [0, 0.38]], 2), C.brass(), 32), 0, 0.32, 0), at(torus(0.17, 0.045, C.brass(), Math.PI * 2, 8, 24), 0, 0.84, 0),
      at(lathe(smoothProfile([[0, -0.14], [0.08, -0.06], [0.07, 0.06], [0.03, 0.16], [0, 0.2]], 2), M(0xfff6c8, { glow: 1.2, tex: null }), 12), 0, -0.22, 0)), yaw: 0.4, pitch: 0.2,
  },
  nest: {
    make: () => { const twig = M(0xa8743c, { rough: 0.9, tex: 'bark', rep: 2 }); const g = grp(at(torus(0.6, 0.24, twig, Math.PI * 2, 12, 40), 0, -0.1, 0, Math.PI / 2, 0, 0, [1, 1, 0.75]), at(cyl(0.48, 0.38, 0.2, M(0x8a5a2c, { tex: 'bark' }), 24), 0, -0.22, 0));
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(tube([[Math.cos(a) * 0.5, 0.0, Math.sin(a) * 0.5], [Math.cos(a + 0.5) * 0.85, 0.06, Math.sin(a + 0.5) * 0.85], [Math.cos(a + 0.8) * 0.95, -0.02, Math.sin(a + 0.8) * 0.95]], 0.025, twig, 8, 5)); }
      const egg = (x: number, z: number, r: number) => at(lathe(smoothProfile([[0, -0.3], [0.2, -0.24], [0.26, -0.05], [0.2, 0.18], [0, 0.32]], 3), M(0x8fd6f4, { rough: 0.3 }), 24), x, 0.08, z, 0.25, 0, r);
      g.add(egg(-0.22, 0.02, 0.3), egg(0.2, -0.04, -0.25), egg(0, 0.22, 0.05)); return g; }, yaw: 0.4, pitch: 0.48,
  },
  bell: {
    make: () => grp(at(lathe(smoothProfile([[0, 0], [0.76, 0], [0.8, 0.05], [0.74, 0.12], [0, 0.12]], 2), C.wood(), 40), 0, -0.7, 0),
      lathe(smoothProfile([[0, 0.38], [0.18, 0.36], [0.4, 0.2], [0.56, -0.12], [0.66, -0.48], [0.7, -0.56], [0, -0.56]], 3), C.brass(), 48),
      at(cyl(0.06, 0.06, 0.16, C.brass(), 10), 0, 0.46, 0), at(lathe(smoothProfile([[0, 0.14], [0.11, 0.1], [0.12, 0.02], [0, 0]], 2), C.brass(), 16), 0, 0.54, 0)), yaw: 0.4, pitch: 0.32,
  },
  phone_off: {
    make: () => grp(ext(shape(rrectPts(0.86, 1.52, 0.16)), 0.12, M(0x3a3048, { rough: 0.35 }), 0.05, 3), at(mesh(new THREE.PlaneGeometry(0.7, 1.2), M(0x5fa0e8, { rough: 0.15, glow: 0.3, tex: null })), 0, 0.03, 0.12),
      at(strokeMesh([[-0.66, -0.7], [0.66, 0.7]], 0.2, C.red(), 0.16, 0.06), 0, 0, 0.2)), yaw: 0.32, pitch: 0.2,
  },
  music: { make: () => { const b = glaze(0x34509a); const head = (x: number, y: number) => jewel(circlePts(0.2, 32).map(([px, py]) => [px * 1.3, py * 0.9] as P2).map(([px, py]) => [px * Math.cos(0.4) - py * Math.sin(0.4) + x, px * Math.sin(0.4) + py * Math.cos(0.4) + y] as P2), b, { rim: 0, depth: 0.1, bevel: 0.08 }); return grp(head(-0.48, -0.58), head(0.42, -0.44), jewelStroke([[-0.26, -0.52], [-0.26, 0.56]], 0.09, b, { rim: 0, bevel: 0.03, depth: 0.06 }), jewelStroke([[0.64, -0.38], [0.64, 0.74]], 0.09, b, { rim: 0, bevel: 0.03, depth: 0.06 }), jewel(roundPoly([[-0.31, 0.62], [0.69, 0.82], [0.69, 0.6], [-0.31, 0.4]], 0.03), b, { rim: 0, depth: 0.08, bevel: 0.05, z: 0.02 })); }, yaw: 0.24, pitch: 0.2 },
  note: { make: () => { const b = glaze(0x34509a); return grp(jewel(circlePts(0.3, 32).map(([px, py]) => [px * 1.25, py * 0.9] as P2).map(([px, py]) => [px * Math.cos(0.35) - py * Math.sin(0.35) - 0.18, px * Math.sin(0.35) + py * Math.cos(0.35) - 0.55] as P2), b, { rim: 0 }), jewelStroke([[0.14, -0.5], [0.14, 0.8]], 0.13, b, { rim: 0, bevel: 0.04, depth: 0.08 }), jewel(roundPoly([[0.08, 0.86], [0.24, 0.86], [0.52, 0.56], [0.58, 0.28], [0.48, 0.06], [0.5, 0.3], [0.38, 0.46], [0.16, 0.54]], 0.03), b, { rim: 0, bevel: 0.04, depth: 0.08 })); }, yaw: 0.26, pitch: 0.2 },
  mic: {
    make: () => { const grille = M(0x9aa4b4, { metal: 0.6, rough: 0.35, tex: 'weave', rep: 3 });
      return grp(at(lathe(smoothProfile([[0, 0.62], [0.2, 0.58], [0.3, 0.46], [0.32, 0.25], [0.31, 0.05], [0, 0.04]], 3), grille, 32), 0, 0.02, 0), at(torus(0.315, 0.035, C.brass(), Math.PI * 2, 8, 32), 0, 0.3, 0, Math.PI / 2), at(lathe(smoothProfile([[0, 0.08], [0.32, 0.06], [0.33, 0], [0.2, -0.1], [0, -0.12]], 2), C.brass(), 24), 0, 0.04, 0),
        at(torus(0.44, 0.045, C.brass(), Math.PI, 8, 24), 0, 0.22, 0, 0, 0, Math.PI), at(cyl(0.045, 0.045, 0.5, C.brass(), 8), 0, -0.46, 0), at(lathe(smoothProfile([[0, 0.1], [0.3, 0.08], [0.42, 0.02], [0.4, -0.04], [0, -0.04]], 2), C.dark(), 32), 0, -0.76, 0)); }, yaw: 0.4, pitch: 0.24,
  },
  speaker_on: { make: () => grp(speaker(), at(torus(0.42, 0.07, C.sky(), 1.4, 8, 24), 0.16, 0, 0, 0, 0, -0.7), at(torus(0.7, 0.07, C.sky(), 1.3, 8, 24), 0.16, 0, 0, 0, 0, -0.65)), yaw: 0.25, pitch: 0.15 },
  speaker_off: { make: () => grp(speaker(), at(grp(jewelStroke([[0.34, -0.3], [0.88, 0.3]], 0.15, glaze(0xc0392f), { rim: 0.04, bevel: 0.05, depth: 0.08 }), jewelStroke([[0.34, 0.3], [0.88, -0.3]], 0.15, glaze(0xc0392f), { rim: 0.04, bevel: 0.05, depth: 0.08, z: 0.02 })), 0, 0, 0.1)), yaw: 0.25, pitch: 0.15 },
  rain: { make: () => grp(at(cloud(C.snow()), 0, 0.3, 0), ...[[-0.36, -0.5], [0.1, -0.68], [0.52, -0.46]].map(([x, y]) => at(lathe(smoothProfile([[0, -0.16], [0.1, -0.1], [0.09, 0.02], [0.04, 0.12], [0, 0.18]], 3), M(0x4aaef0, { rough: 0.15, tex: 'water' }), 16), x, y, 0.1, 0, 0, -0.2))), yaw: 0.28, pitch: 0.2 },
  drop: { make: () => lathe(smoothProfile([[0, -0.8], [0.34, -0.72], [0.56, -0.45], [0.55, -0.15], [0.36, 0.25], [0.12, 0.65], [0, 0.85]], 3), M(0x4aaef0, { rough: 0.1, metal: 0.1, env: 1.4, tex: 'water' }), 40), yaw: 0.3, pitch: 0.2 },
  waves: { make: () => grp(...[0.55, 0, -0.55].map((y, i) => tube(Array.from({ length: 9 }, (_, k) => [-0.9 + k * 0.225, y + Math.sin(k * 1.4 + i) * 0.13, 0] as [number, number, number]), 0.1, M([0x8ad6ff, 0x5ab4f0, 0x3a8ad8][i], { rough: 0.22, tex: 'water' }), 40, 10))), yaw: 0.25, pitch: 0.2 },
  wind: { make: () => grp(...([[0.5, 0.9], [0, 1.1], [-0.5, 0.75]] as P2[]).map(([y, l]) => tube([[-0.9, y, 0], [-0.9 + l * 0.6, y, 0], [-0.9 + l, y + 0.08, 0], [-0.9 + l + 0.1, y + 0.28, 0], [-0.9 + l - 0.12, y + 0.36, 0]], 0.09, M(0xeaf6ff, { rough: 0.4 }), 40, 10))), yaw: 0.25, pitch: 0.2 },
  campfire: {
    make: () => { const bark = M(0x7a4a26, { tex: 'bark', rough: 0.85 }), end = M(0xe8b070, { tex: 'grain', rough: 0.7 });
      const log = (a: number, tilt: number) => { const g = grp(at(cyl(0.13, 0.15, 1.3, bark, 12), 0, 0, 0), at(cyl(0.13, 0.13, 0.01, end, 12), 0, 0.655, 0), at(cyl(0.15, 0.15, 0.01, end, 12), 0, -0.655, 0)); return at(g, 0, -0.58, 0, Math.PI / 2 - tilt, a, 0); };
      const stone = (a: number) => at(lathe(smoothProfile([[0, 0.12], [0.16, 0.1], [0.2, 0.02], [0.16, -0.06], [0, -0.07]], 2), M(0x9aa0a8, { rough: 0.8, tex: 'stone' }), 10), Math.cos(a) * 0.74, -0.74, Math.sin(a) * 0.74, 0, a, 0);
      return grp(log(0.5, 0.25), log(-0.6, 0.2), log(1.7, 0.18), ...[0, 1.2, 2.4, 3.6, 4.8].map(stone),
        ...([[0, 0, 1], [-0.2, -0.04, 0.7], [0.22, 0.02, 0.75], [0.06, -0.06, 0.55]] as [number, number, number][]).map(([x, z, k]) => at(lathe(smoothProfile([[0, -0.4], [0.3, -0.25], [0.28, 0], [0.14, 0.35], [0, 0.66]], 3), C.flame(), 16), x, -0.1, z, 0, 0, x * 0.6, [k * 0.8, k, k * 0.8])),
        at(lathe(smoothProfile([[0, -0.3], [0.2, -0.15], [0.15, 0.08], [0, 0.3]], 3), C.flameIn(), 16), 0, -0.2, 0.18), at(lathe(smoothProfile([[0, -0.1], [0.08, -0.04], [0.05, 0.06], [0, 0.12]], 2), unlit(0xfff4c0), 10), 0, -0.24, 0.26)); }, yaw: 0.4, pitch: 0.34,
  },
  leaf: { make: () => grp(leafMesh(0.92, 0.5, C.leaf(), 9), at(cyl(0.025, 0.035, 1.5, M(0x3e8a32, { tex: null }), 6), 0, -0.2, 0.05)), yaw: 0.3, pitch: 0.32 },
  book: { make: () => { const b = journal(); b.ribbon.visible = false; return b.root; }, yaw: 0.5, pitch: 0.2 },
  pen: {
    make: () => { const lac = M(0x2c58c0, { rough: 0.2 }); return at(grp(lathe(smoothProfile([[0, -0.36], [0.1, -0.34], [0.14, -0.2], [0.15, 0.5], [0.12, 0.66], [0, 0.7]], 3), lac, 24), at(torus(0.15, 0.025, C.gold(), Math.PI * 2, 6, 24), 0, 0.12, 0, Math.PI / 2), at(torus(0.145, 0.02, C.gold(), Math.PI * 2, 6, 24), 0, 0.5, 0, Math.PI / 2),
      at(lathe(smoothProfile([[0, -0.42], [0.05, -0.36], [0.1, -0.2], [0.12, 0], [0, 0]], 2), C.gold(), 16), 0, -0.36, 0), strokeMesh([[0.18, 0.62], [0.18, 0.2]], 0.06, C.gold(), 0.04, 0.015)), 0, 0, 0, 0, 0, -0.75); }, yaw: 0.3, pitch: 0.3,
  },
  jar: {
    make: () => grp(lathe(smoothProfile([[0, -0.8], [0.5, -0.78], [0.58, -0.6], [0.58, 0.38], [0.46, 0.54], [0.38, 0.6], [0, 0.6]], 3), M(0xa8dcec, { rough: 0.08, metal: 0.1, tex: null, env: 1.2, opacity: 0.32 }), 40), at(lathe(smoothProfile([[0, 0.12], [0.4, 0.12], [0.43, 0.06], [0.42, 0], [0, 0]], 2), C.brass(), 32), 0, 0.62, 0),
      ...[[-0.2, -0.2], [0.18, 0.1], [0.05, -0.5], [-0.12, 0.28]].map(([x, y]) => at(ball(0.13, M(0xffe070, { glow: 1.4, tex: null }), 10, 8), x, y, 0.4))), yaw: 0.4, pitch: 0.2,
  },
  hanger: { make: () => hanger(), yaw: 0.3, pitch: 0.24 },
  brush: {
    make: () => at(grp(lathe(smoothProfile([[0, -0.8], [0.08, -0.78], [0.1, -0.3], [0.08, 0.2], [0.1, 0.3]], 2), C.wood(), 16), at(lathe(smoothProfile([[0.1, 0], [0.13, 0.1], [0.13, 0.25], [0.11, 0.32]], 2), C.silver(), 16), 0, 0.28, 0),
      at(lathe(smoothProfile([[0.11, 0], [0.14, 0.12], [0.11, 0.3], [0, 0.42]], 3), M(0xf2d9a0, { tex: 'grain' }), 16), 0, 0.6, 0), at(lathe(smoothProfile([[0.09, 0], [0.06, 0.1], [0, 0.16]], 2), C.blue(), 12), 0, 0.92, 0)), 0, 0, 0, 0, 0, -0.75), yaw: 0.3, pitch: 0.3,
  },
  pushpin: { make: () => at(grp(lathe(smoothProfile([[0, 0.7], [0.36, 0.66], [0.38, 0.56], [0.2, 0.5], [0.18, 0.2], [0.42, 0.1], [0.44, 0.02], [0, 0]], 3), C.red(), 32), at(cyl(0.025, 0.012, 0.6, C.silver(), 8), 0, -0.3, 0)), 0, 0, 0, 0, 0, 0.55), yaw: 0.4, pitch: 0.3 },
  magnifier: { make: () => grp(at(torus(0.5, 0.09, C.brass(), Math.PI * 2, 10, 40), -0.2, 0.25, 0), at(cyl(0.48, 0.48, 0.04, M(0xd2f0ff, { rough: 0.04, metal: 0.2, tex: null, env: 2 }), 32), -0.2, 0.25, 0, Math.PI / 2), at(lathe(smoothProfile([[0, -0.5], [0.09, -0.46], [0.1, 0], [0.07, 0.3], [0.08, 0.34]], 2), C.wood(), 16), 0.42, -0.38, 0, 0, 0, Math.PI * 0.75)), yaw: 0.28, pitch: 0.24 },
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
  map: { make: () => { const g = grp(); const tx = mapTex(); for (let i = 0; i < 3; i++) { const p = mesh(new THREE.PlaneGeometry(0.62, 1.4), new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.8 })); const uv = p.geometry.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3); g.add(at(p, -0.6 + i * 0.6, 0, i % 2 ? -0.12 : 0, 0, i % 2 ? 0.35 : -0.35, 0)); } return g; }, yaw: 0.2, pitch: 0.25 },
  gear: { make: () => gear(M(0xe6ae50, { metal: 0.55, rough: 0.32, tex: 'plain', env: 1.0 }), 10, M(0xa8722e, { metal: 0.6, rough: 0.36, tex: 'plain' })), yaw: 0.3, pitch: 0.3 },
  treehouse: {
    make: () => { const lv = [M(0x4caa3c, { rough: 0.6, tex: 'foliage' }), M(0x62c448, { rough: 0.6, tex: 'foliage' }), M(0x3e9434, { rough: 0.6, tex: 'foliage' })];
      const clump = (x: number, y: number, r: number, m: THREE.Material) => { const g = new THREE.IcosahedronGeometry(r, 2); const p = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(1 + (fbm(v.x * 6 + 3, v.y * 6 + v.z * 4, 5) - 0.5) * 0.35); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return at(mesh(g, m), x, y, 0); };
      const house = grp(ext(shape([[-0.26, -0.2], [0.26, -0.2], [0.26, 0.14], [0, 0.34], [-0.26, 0.14]]), 0.3, C.oak(), 0.03, 2), at(ext(shape([[-0.34, 0.1], [0, 0.4], [0.34, 0.1], [0.3, 0.06], [0, 0.32], [-0.3, 0.06]]), 0.38, C.red(), 0.03, 2), 0, 0.02, 0), at(ext(shape(rrectPts(0.14, 0.18, 0.05)), 0.02, M(0xffd87a, { glow: 0.7, tex: null }), 0.01, 1), 0, -0.02, 0.17));
      return grp(at(lathe(smoothProfile([[0.34, -1.0], [0.24, -0.8], [0.18, -0.3], [0.16, 0.2]], 2), M(0x8a5a32, { tex: 'bark' }), 16), 0, 0, 0), clump(-0.34, 0.34, 0.46, lv[0]), clump(0.32, 0.4, 0.5, lv[2]), clump(0, 0.7, 0.46, lv[1]), at(house, 0.02, -0.36, 0.22)); }, yaw: 0.3, pitch: 0.18,
  },
  birdhouse: {
    make: () => grp(at(ext(shape([[-0.45, -0.7], [0.45, -0.7], [0.45, 0.1], [0, 0.5], [-0.45, 0.1]]), 0.8, C.oak(), 0.04, 2), 0, 0, 0),
      at(ext(shape(rrectPts(0.78, 0.07, 0.03)), 1.0, C.red(), 0.02, 1), -0.25, 0.36, 0, 0, 0, 0.72), at(ext(shape(rrectPts(0.78, 0.07, 0.03)), 1.0, C.red(), 0.02, 1), 0.25, 0.36, 0, 0, 0, -0.72),
      at(cyl(0.15, 0.15, 0.06, C.ink(), 20), 0, -0.12, 0.4, Math.PI / 2), at(cyl(0.03, 0.03, 0.26, C.dark(), 8), 0, -0.4, 0.48, Math.PI / 2), at(cyl(0.06, 0.07, 0.5, C.dark(), 8), 0, -0.95, 0)), yaw: 0.45, pitch: 0.2,
  },
  cursor_hand: {
    make: () => { const skin = M(0xffe2bc, { rough: 0.55 });
      const pts: P2[] = [[-0.42, 0.78], [-0.38, 0.88], [-0.3, 0.92], [-0.22, 0.88], [-0.18, 0.78], [-0.18, 0.26], [-0.14, 0.32], [-0.04, 0.34], [0.04, 0.3], [0.07, 0.2], [0.11, 0.25], [0.2, 0.27], [0.27, 0.22], [0.29, 0.12], [0.33, 0.16], [0.42, 0.16], [0.49, 0.1], [0.51, 0.0],
        [0.55, -0.2], [0.52, -0.46], [0.42, -0.66], [0.28, -0.78], [-0.26, -0.78], [-0.42, -0.62], [-0.5, -0.36], [-0.56, -0.2], [-0.7, -0.06], [-0.76, 0.04], [-0.72, 0.12], [-0.6, 0.1], [-0.46, 0.0], [-0.42, 0.18]];
      return grp(ext(shape(pts), 0.28, skin, 0.12, 4), at(ext(shape(rrectPts(0.92, 0.2, 0.06)), 0.4, C.sky(), 0.05, 2), 0.16, -0.86, 0)); }, yaw: 0.28, pitch: 0.2,
  },
  stats: {
    make: () => grp(at(ext(shape(rrectPts(1.7, 0.16, 0.06)), 0.5, C.wood(), 0.03, 2), 0, -0.82, 0),
      ...([[-0.52, 0.66, C.green()], [0, 1.06, C.gold()], [0.52, 1.46, C.blue()]] as [number, number, THREE.Material][]).map(([x, h, m]) => at(ext(shape(rrectPts(0.34, h, 0.1)), 0.32, m, 0.04, 2), x, -0.74 + h / 2, 0)),
      at(ext(shape(strokePts([[-0.7, -0.1], [-0.2, 0.3], [0.15, 0.1], [0.66, 0.66]], 0.1)), 0.06, C.red(), 0.03, 2), 0, 0.1, 0.3), at(ext(shape([[0.5, 0.74], [0.82, 0.84], [0.74, 0.52]]), 0.06, C.red(), 0.03, 2), 0, 0.06, 0.3)), yaw: 0.42, pitch: 0.24,
  },
  nights: { make: () => grp(at(moonJewel(0.65, 0.55, [0.3, 0.18]), -0.2, 0, 0), at(goldStar(0.3, 0.13), 0.62, 0.55, 0), at(goldStar(0.21, 0.09), 0.72, -0.35, 0)), yaw: 0.24, pitch: 0.24 },
  things: {
    make: () => { const wood = M(0xc8783a, { tex: 'grain', rough: 0.55 }), band = M(0x6a5a5a, { metal: 0.6, rough: 0.4, tex: null });
      const lidG = new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24, 1, false, 0, Math.PI); lidG.rotateZ(Math.PI / 2);
      return grp(at(ext(shape(rrectPts(1.3, 0.62, 0.05)), 0.84, wood, 0.03, 2), 0, -0.3, 0), at(mesh(lidG, wood), 0, 0.02, 0, 0, 0, 0, [1, 0.8, 1]),
        ...[-0.42, 0.42].map((x) => grp(at(ext(shape(rrectPts(0.1, 0.62, 0.02)), 0.88, band, 0.015, 1), x, -0.3, 0), at(torus(0.425, 0.05, band, Math.PI, 6, 20), x, 0.02, 0, 0, Math.PI / 2, 0, [1, 0.8, 1]))),
        at(ext(shape(rrectPts(0.22, 0.28, 0.05)), 0.04, C.gold(), 0.02, 2), 0, -0.04, 0.45), at(ext(shape(circlePts(0.04, 12)), 0.02, C.ink(), 0.01, 1), 0, -0.06, 0.49),
        at(moonGem(), 0.32, 0.4, 0.06, 0.3, 0.4, -0.3, 0.3), at(acorn(0.3, 0.6), -0.3, 0.42, 0.1)); }, yaw: 0.55, pitch: 0.32,
  },
  seals: { make: () => { const pts: P2[] = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, r = 0.62 + Math.sin(a * 7) * 0.04 + (h2(i, 1, 2) - 0.5) * 0.04; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.2]); } const rib = M(0x2f4f8a, { rough: 0.35, tex: 'weave' }), wax = M(0xb0302c, { rough: 0.32, tex: 'plain' }); const tail = (s: number) => at(ext(shape(roundPoly([[s * -0.1, -0.1], [s * 0.12, -0.1], [s * 0.38, -0.96], [s * 0.28, -0.84], [s * 0.18, -1.0]], 0.02)), 0.04, rib, 0.02, 1), 0, 0, -0.12); return grp(tail(-1), tail(1), ext(shape(pts), 0.16, wax, 0.1, 4), at(torus(0.38, 0.05, M(0x8a2024, { rough: 0.35, tex: 'plain' }), Math.PI * 2, 8, 48), 0, 0.2, 0.15), at(goldStar(0.26, 0.11, 5, M(0xd04a40, { rough: 0.3, tex: 'plain' })), 0, 0.2, 0.16)); }, yaw: 0.26, pitch: 0.26 },
  wd_feather: { make: () => { const vane: P2[] = []; for (let i = 0; i <= 50; i++) { const t = (i / 50) * Math.PI * 2, y = Math.cos(t); const notch = Math.sin(t * 13) > 0.85 ? 0.88 : 1; vane.push([Math.sin(t) * 0.3 * (1 + 0.2 * y) * notch, y * 0.86 + 0.12]); }
    return at(grp(ext(shape(vane), 0.04, M(0xd8905a, { tex: 'grain', rough: 0.6 }), 0.03, 2), at(cyl(0.025, 0.035, 1.95, C.cream(), 8), 0, -0.03, 0.04)), 0, 0, 0, 0, 0, -0.6); }, yaw: 0.28, pitch: 0.28 },
  tophat: { make: () => grp(lathe(smoothProfile([[0, -0.5], [0.95, -0.5], [0.98, -0.44], [0.62, -0.4], [0.56, -0.3], [0.55, 0.5], [0.6, 0.6], [0, 0.62]], 2), M(0x3a2a52, { rough: 0.45, tex: 'felt' }), 48), at(cyl(0.565, 0.57, 0.2, C.red(), 40), 0, -0.26, 0), at(ext(shape(rrectPts(0.2, 0.16, 0.04)), 0.04, C.gold(), 0.02, 1), 0.2, -0.26, 0.55, 0, 0.35, 0)), yaw: 0.4, pitch: 0.32 },
  wd_glasses: { make: () => grp(...[-0.48, 0.48].map((x) => at(torus(0.36, 0.075, C.gold(), Math.PI * 2, 10, 40), x, 0, 0)), ...[-0.48, 0.48].map((x) => at(cyl(0.33, 0.33, 0.03, M(0x8fd8ff, { rough: 0.06, metal: 0.2, tex: null, env: 2 }), 32), x, 0, -0.01, Math.PI / 2)), at(torus(0.14, 0.055, C.gold(), Math.PI, 8, 16), 0, 0.08, 0), ...[-1, 1].map((sx) => tube([[sx * 0.84, 0.1, -0.02], [sx * 0.92, 0.12, -0.3], [sx * 0.9, 0.0, -0.5]], 0.04, C.gold(), 12, 6))), yaw: 0.3, pitch: 0.2 },
  wd_scarf: { make: () => { const st = new THREE.MeshStandardMaterial({ map: stripeTex(['#b8322e', '#efdcb8', '#b8322e', '#2f4f8a'], [3, 1, 3, 1]), roughness: 0.8, side: THREE.DoubleSide }); const fr = M(0xefdcb8, { rough: 0.8, tex: 'weave' }); const drape = ribbon([[-0.2, -0.95, 0.12], [-0.17, -0.2, 0.1], [-0.08, 0.32, 0.08], [0.04, 0.44, 0], [0.16, 0.32, -0.08], [0.24, -0.2, -0.1], [0.28, -0.75, -0.1]], 0.38, st, { normal: [0, 0, 1], seg: 48 }); const fringe = (x: number, y: number, z: number) => grp(...[0, 1, 2, 3, 4].map((i) => at(cyl(0.022, 0.022, 0.15, fr, 5), x - 0.14 + i * 0.07, y - 0.08, z))); return grp(at(hanger(), 0.04, 0.62, 0, 0, 0, 0, 0.62), drape, fringe(-0.2, -0.95, 0.12), fringe(0.28, -0.75, -0.1)); }, yaw: 0.3, pitch: 0.16 },
  wd_sweater: { make: () => sweater(), yaw: 0.3, pitch: 0.15 },
  wd_cape: { make: () => { const vel = M(0x5a3a8a, { rough: 0.6, tex: 'felt' }), lin = M(0xc8963e, { rough: 0.4, tex: 'plain' }); const prof = smoothProfile([[0.88, -0.86], [0.74, -0.4], [0.62, 0.1], [0.56, 0.36], [0.44, 0.5], [0.2, 0.56]], 3).map(([x, y]) => V2c(x, y)); const shell = (r: number, m: THREE.Material, side: THREE.Side) => { const geo = new THREE.LatheGeometry(prof.map((p) => V2c(p.x * r, p.y)), 48, 0.2, Math.PI * 2 - 0.4); const p = geo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), t = Math.max(0, (0.2 - y) / 1.06), k = 1 + Math.sin(a * 6) * 0.12 * t; p.setXYZ(i, x * k, y, z * k); } geo.computeVertexNormals(); const me = mesh(geo, m); (me.material as THREE.Material).side = side; return me; }; return grp(shell(1, vel, THREE.FrontSide), shell(0.97, lin, THREE.BackSide), at(torus(0.3, 0.1, M(0x7a52b0, { rough: 0.6, tex: 'felt' }), Math.PI * 2, 10, 32), 0, 0.52, 0, Math.PI / 2, 0, 0, [1, 1, 0.7]), at(jewel(crescentPts(0.13, 0.11, [0.06, 0.035], 48), C.gold(), { rim: 0, depth: 0.04, bevel: 0.03 }), 0, 0.44, 0.3), at(hanger(), 0, 0.72, -0.05, 0, 0, 0, 0.55)); }, yaw: 0.35, pitch: 0.2 },
  wd_mirror: { make: () => grp(at(torus(0.48, 0.09, C.brass(), Math.PI * 2, 10, 40), 0, 0.3, 0, 0, 0, 0, [1, 1.2, 1]), at(cyl(0.47, 0.47, 0.05, M(0xcfeeff, { rough: 0.04, metal: 0.5, tex: null, env: 2 }), 32), 0, 0.3, 0, Math.PI / 2, 0, 0, [1, 1, 1.2]), at(lathe(smoothProfile([[0.06, -0.5], [0.1, -0.44], [0.07, -0.1], [0.09, 0.0], [0.12, 0.08]], 2), C.brass(), 16), 0, -0.4, 0), at(lathe(smoothProfile([[0, 0], [0.1, 0.02], [0.13, 0.08], [0.06, 0.14]], 2), C.brass(), 16), 0, -1.02, 0)), yaw: 0.3, pitch: 0.2 },
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
  bp_lamp: {
    make: () => grp(at(lathe(smoothProfile([[0.3, 0], [0.5, -0.32], [0.64, -0.56], [0.6, -0.58], [0.28, -0.04]], 3), M(0xffc46a, { rough: 0.8, glow: 0.35, tex: 'weave', side: THREE.DoubleSide }), 40), 0, 0.74, 0),
      at(lathe(smoothProfile([[0.04, -0.6], [0.05, 0], [0.04, 0.5]], 2), C.brass(), 10), 0, -0.1, 0), at(lathe(smoothProfile([[0, -0.86], [0.5, -0.84], [0.53, -0.78], [0.3, -0.72], [0.14, -0.6], [0.06, -0.58], [0, -0.58]], 3), C.brass(), 40), 0, 0, 0),
      at(lathe(smoothProfile([[0, -0.1], [0.1, -0.04], [0.1, 0.06], [0, 0.14]], 2), M(0xfff4c0, { glow: 1.2, tex: null }), 12), 0, 0.3, 0)), yaw: 0.4, pitch: 0.24,
  },
  bp_plant: { make: glb('items/fernpot.glb'), yaw: 0.5, pitch: 0.3 },
  bp_rug: { make: () => at(mesh(new THREE.CylinderGeometry(1, 1, 0.08, 64), new THREE.MeshStandardMaterial({ map: ringTex(), roughness: 0.9 })), 0, 0, 0, 0, 0, 0, [1, 1, 0.75]), yaw: 0.2, pitch: 0.95 },
  bp_wall: { make: () => { const gold = M(0xd8a040, { metal: 0.6, rough: 0.32, tex: 'plain' }); const outer = shape(rrectPts(1.7, 1.32, 0.06)), hole = new THREE.Path(); rrectPts(1.36, 0.98, 0.02).forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y))); outer.holes.push(hole); const pic = mesh(planarUV(new THREE.PlaneGeometry(1.4, 1.02)), new THREE.MeshStandardMaterial({ map: landscape(), roughness: 0.8 })); return grp(ext(outer, 0.12, gold, 0.06, 3), at(pic, 0, 0, -0.02), at(ext(shape(rrectPts(1.44, 1.06, 0.02)), 0.04, M(0x8a5a26, { metal: 0.5, rough: 0.4, tex: 'plain' }), 0.015, 1), 0, 0, -0.06)); }, yaw: 0.22, pitch: 0.12 },
  bp_decor: {
    make: () => { const flower = (x: number, y: number, c: number) => { const pet: P2[] = Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2, r = 0.2 * (0.6 + 0.4 * Math.abs(Math.cos(a * 2.5))); return [Math.cos(a) * r, Math.sin(a) * r]; });
      return grp(tube([[0, 0.1, 0], [x * 0.5, y * 0.6, 0], [x, y, 0]], 0.035, M(0x3e9a3a, { tex: null }), 12, 5), at(ext(shape(pet), 0.05, M(c, { rough: 0.5 }), 0.03, 2), x, y, 0.04), at(ext(shape(circlePts(0.06, 16)), 0.04, M(0xffd040, { tex: null }), 0.02, 1), x, y, 0.1)); };
      return grp(lathe(smoothProfile([[0, -0.85], [0.36, -0.84], [0.48, -0.5], [0.44, -0.2], [0.2, 0.05], [0.24, 0.16], [0, 0.16]], 3), M(0x3d8fd8, { rough: 0.25 }), 40), flower(-0.3, 0.75, 0xf06a86), flower(0.1, 0.92, 0xffd44a), flower(0.38, 0.64, 0xf5f0ff)); }, yaw: 0.35, pitch: 0.2,
  },
  bp_fun: { make: glb('items/rocking_horse.glb'), yaw: 0.7, pitch: 0.24 },
  bp_wallpaper: { make: () => { const t = stripeTex(); const roll = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.5, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); const sheet = mesh(new THREE.PlaneGeometry(0.9, 1.5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide })); return grp(at(roll, -0.35, 0, 0), at(sheet, 0.4, -0.1, 0.25, -0.2, -0.3, 0), at(cyl(0.1, 0.1, 1.52, C.kraft(), 16), -0.35, 0, 0)); }, yaw: 0.4, pitch: 0.25 },
  bp_floor: { make: () => grp(...[-0.5, 0, 0.5].map((x, i) => at(ext(shape(rrectPts(0.46, 1.5, 0.04)), 0.12, [C.wood(), C.oak(), C.dark()][i], 0.02, 1), x, 0, i === 1 ? 0.06 : 0, -Math.PI / 2))), yaw: 0.5, pitch: 0.6 },
  bp_season: {
    make: () => { const pap = M(0xe0363c, { rough: 0.45 }); return grp(ext(shape(rrectPts(1.1, 0.9, 0.04)), 1.1, pap, 0.03, 2), at(ext(shape(rrectPts(1.18, 0.22, 0.04)), 1.18, pap, 0.03, 2), 0, 0.5, 0), at(ext(shape(rrectPts(0.2, 0.96, 0.02)), 1.14, C.gold(), 0.02, 1), 0, 0.02, 0), at(ext(shape(rrectPts(1.14, 0.96, 0.02)), 0.2, C.gold(), 0.02, 1), 0, 0.02, 0),
      at(torus(0.2, 0.065, C.gold(), Math.PI * 2, 8, 24), -0.18, 0.72, 0, 0, 0.4, 0.4), at(torus(0.2, 0.065, C.gold(), Math.PI * 2, 8, 24), 0.18, 0.72, 0, 0, -0.4, -0.4)); }, yaw: 0.6, pitch: 0.34,
  },
  bp_move: { make: () => jewel(roundPoly([[-0.12, 0.12], [-0.12, 0.5], [-0.32, 0.5], [0, 0.9], [0.32, 0.5], [0.12, 0.5], [0.12, 0.12], [0.5, 0.12], [0.5, 0.32], [0.9, 0], [0.5, -0.32], [0.5, -0.12], [0.12, -0.12], [0.12, -0.5], [0.32, -0.5], [0, -0.9], [-0.32, -0.5], [-0.12, -0.5], [-0.12, -0.12], [-0.5, -0.12], [-0.5, -0.32], [-0.9, 0], [-0.5, 0.32], [-0.5, 0.12]], 0.04), glaze(0x4a8ac4), { rim: 0, depth: 0.2, bevel: 0.1 }), yaw: 0.26, pitch: 0.26 },
  bp_buy: {
    make: () => { const sh = shape([[-0.8, -0.5], [0.3, -0.5], [0.85, 0], [0.3, 0.5], [-0.8, 0.5]]); const hl = new THREE.Path(); hl.absarc(0.5, 0, 0.1, 0, Math.PI * 2, true); sh.holes.push(hl);
      const nutS = shape(Array.from({ length: 28 }, (_, i) => { const t = (i / 28) * Math.PI * 2, y = Math.cos(t); return [Math.sin(t) * 0.2 * (y < 0 ? 1 - (-y) * 0.35 : 1), y * 0.24 - 0.04] as P2; }));
      const capS = shape(Array.from({ length: 18 }, (_, i) => { const t = (i / 17) * Math.PI; return [Math.cos(t) * 0.25, Math.sin(t) * 0.14] as P2; }));
      const stamp = grp(at(ext(nutS, 0.04, C.gold(), 0.02, 2), 0, -0.1, 0), at(ext(capS, 0.04, M(0x8a5020, { rough: 0.6, tex: null }), 0.02, 2), 0, 0.08, 0.01));
      return grp(ext(sh, 0.06, M(0xf0c890, { rough: 0.8, tex: 'weave' }), 0.03, 2), at(stamp, -0.25, 0.02, 0.07), tube([[0.5, 0.1, 0], [0.66, 0.46, 0.06], [0.74, 0.86, 0]], 0.035, C.red(), 12, 5)); }, yaw: 0.22, pitch: 0.22,
  },
  // the side tools
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
    res[name] = paintFinish(passes(obj, n, n, ss, sph.center, sph.radius), { groups: groupOf, outline, outlineAlpha: 0.35, ink, lineDepth: sp.fin?.lineDepth ?? 0.045 });
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
  // the cuckoo clock: the body (no pendulum, no hands) with its door and owl, then the pendulum on its own
  const clock = cuckooClock();
  simpleDial(clock.root);
  onShelf(clock.root, 'clock');
  clock.hour.visible = clock.minute.visible = false;
  const owl0 = { y: clock.owl.position.y, s: clock.owl.scale.x };
  clock.door.rotation.y = -2.1; clock.owl.position.z = 0.25; clock.owl.scale.setScalar(owl0.s + 0.55 + 0.12);
  const cr = shelfRect([clock.root]);
  for (const [n, door, outK, bob] of [['clock0', 0, 0, 0], ['clock1', 0.9, 0.3, 0], ['clock2', 2.1, 1, 0], ['clock3', 2.1, 1, 1]] as [string, number, number, number][]) {
    clock.door.rotation.y = -door;
    clock.owl.position.z = outK * 0.25;
    clock.owl.rotation.x = bob * 0.45;
    clock.owl.scale.setScalar(owl0.s + outK * 0.55 + bob * 0.12);
    clock.pendulum.visible = false;
    out.push(shootShelf(n, clock.root, cr));
  }
  clock.door.rotation.y = 0; clock.owl.position.z = 0; clock.owl.rotation.x = 0; clock.owl.scale.setScalar(owl0.s);
  // the pendulum alone: hide everything else
  const shown = new Map<O, boolean>();
  clock.body.children.forEach((c) => { shown.set(c, c.visible); c.visible = c === clock.pendulum; });
  clock.pendulum.rotation.z = 0.3;
  const prA = shelfRect([clock.pendulum]);
  clock.pendulum.rotation.z = -0.3;
  const prB = shelfRect([clock.pendulum]);
  const pr: [number, number, number, number] = [Math.min(prA[0], prB[0]), Math.min(prA[1], prB[1]), 0, 0];
  pr[2] = Math.max(prA[0] + prA[2], prB[0] + prB[2]) - pr[0]; pr[3] = Math.max(prA[1] + prA[3], prB[1] + prB[3]) - pr[1];
  [-0.26, -0.13, 0, 0.13, 0.26].forEach((a, i) => { clock.pendulum.rotation.z = a; out.push(shootShelf('pend' + i, clock.root, pr)); });
  clock.body.children.forEach((c) => { c.visible = shown.get(c) ?? true; });
  // the dial: its centre and radius in art px (the hands are drawn there live)
  const dialM = clock.root.getObjectByName('dial')!;
  dialM.updateMatrixWorld(true);
  const c0 = shelfPx(dialM.localToWorld(new THREE.Vector3(0, 0, 0))), c1 = shelfPx(dialM.localToWorld(new THREE.Vector3(0.38, 0, 0)));
  const dial: [number, number, number] = [c0[0], c0[1], Math.hypot(c1[0] - c0[0], c1[1] - c0[1])];
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
  if (only) { w.__done = true; return; }
  // the icons' atlas: the 256 px drawings, 16 to a row
  const AW = 4096, grids = {} as Record<SizeName, [number, number, number]>;
  let y = 0;
  for (const [sz, n] of SIZES) { const cols = Math.floor(AW / n); grids[sz] = [n, cols, y]; y += Math.ceil(cells.length / cols) * n; }
  const atlas = document.createElement('canvas');
  atlas.width = AW; atlas.height = y;
  const ag = atlas.getContext('2d')!;
  for (const [sz, n] of SIZES) { const [, cols, y0] = grids[sz]; cells.forEach((c, i) => ag.putImageData(new ImageData(new Uint8ClampedArray(c[sz].d), n, n), (i % cols) * n, y0 + Math.floor(i / cols) * n)); }
  // the shelf's atlas: its sprites packed in rows (tallest first), 2 px apart
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
  const json = JSON.stringify({ atlas: 'img/ui3d.webp', hd: grids.hd, icons, anim, shelf: shelfIdx });
  w.__module = `// GENERATED by src/dev/iconbake.ts (/dev-iconbake.html; a tools script writes window.__module here, window.__atlas to
// public/img/ui3d.webp and window.__shelfAtlas to public/img/ui3d-shelf.webp): the interface atlases' index. Every
// interface icon is a detailed 3D model rendered realistically with its real textures at 256 px ("hd"). { atlas, hd: [px,
// cells per row, y of the first row], icons: { name: cell }, anim: { name: [cells] }, shelf: the main buttons' sprites { atlas, res: px per
// art px, box: [w, h, how far above the nav] in art px, sprites: { name: [atlas x, y, w, h (atlas px), x, y in the box
// (art px)] }, dial: [x, y, radius], lamp: [x, y] of the flame, objects: { id: centre x } } }. Models: the game's own
// GLBs, the shelf's props (src/ui/chrome/props3d.ts) and models made in the bake; credits in docs/credits.
export interface ShelfIndex { atlas: string; res: number; box: [number, number, number]; sprites: Record<string, [number, number, number, number, number, number]>; dial: [number, number, number]; lamp: [number, number]; objects: Record<string, number> }
export const ICONS3D: { atlas: string; hd: [number, number, number]; icons: Record<string, number>; anim: Record<string, number[]>; shelf: ShelfIndex } = ${json};
`;
  w.__atlas = atlas.toDataURL('image/png');
  w.__shelfAtlas = shelfAtlas.toDataURL('image/png');
  w.__done = true;
}
void bake();
