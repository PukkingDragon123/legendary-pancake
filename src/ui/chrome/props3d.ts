// [icons6] Real 3D interface props: properly shaped, detailed models, the source of the main buttons' painted
// sprites and of several icons ([icons8, icons9] the icon bake, src/dev/iconbake.ts, renders them and finishes them as
// hand-painted art; the shelf on screen, shelf2d.tsx, is 2D). Dev only: nothing here ships in the app.
//   oilLamp()    [icons9] a bedside oil lamp: an engraved brass foot with a finger loop, a ruby glass font, a brass
//                burner with a wick wheel, a glass chimney round a warm flame
//   cuckooClock() a carved Black Forest cuckoo clock on a little stand: a leafy roof and crest, an enamel dial with the
//                real time in a wreath of carved leaves, a cuckoo door with an owl behind it, a leaf pendulum, pine-cone
//                weights on chains
//   journal()    a tooled leather journal: gilt corners, a tooled cover (no emblem), raised spine bands, page block, a
//                satin ribbon, a strap with a brass stud; the cover swings open on its hinge
//   shelf()      a carved walnut shelf: moulded nose, carved scroll ends and acorn rosettes, brass name plates
// [tex7] Every surface is textured, realistically (src/ui/chrome/paint3d.ts): photo-grained oak and walnut, pebbled
// leather, linen, under painted detail where a photo can't go: carved veined oak leaves, a shingled roof, engraved and
// tarnished brass, an enamel dial with Roman numerals and crazing, a tooled and stitched cover, inked paper, a feathered owl, scaled pine cones and acorn caps. Painted textures stand in for the photo
// ones until those are registered (`upgradePhotos`). Laid on at one density (`fitUV`; the icon bake refits).
import * as THREE from 'three';
import { clamp, fbm, hash, hex, mix, mul, PAL, rampAt, vnoise, type RGB } from '../px/relief.ts';
import { Canvas3, cloth, DENSITY, enamel, feathers, fitUV, keepUV, leafTex, leatherCanvas, metal, metalCanvas, noise, paperCanvas, ramp, scales, shingles, stitches, swatchAt, swatchCanvas, wood, type Painted, type Swatch } from './paint3d.ts';

/** the shelf's texture density (texture repeats per model unit) */
export const SHELF_DENSITY = DENSITY;

// ------------------------------------------------------------------ textures

const texCache = new Map<string, THREE.Texture>();
type Paint = (x: number, y: number) => RGB | [number, number, number, number];
/** paint a w x h texture per pixel (cached by key); `data` for non-colour maps (bump, roughness) */
export function paintTex(key: string, w: number, h: number, f: Paint, o: { repeat?: boolean; data?: boolean; smooth?: boolean } = {}): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = f(x, y), o4 = (y * w + x) * 4;
    d[o4] = v[0]; d[o4 + 1] = v[1]; d[o4 + 2] = v[2]; d[o4 + 3] = v.length > 3 ? (v as number[])[3] : 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.magFilter = o.smooth ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
/** a painted texture's maps as material parameters */
export const pm = (p: Painted): THREE.MeshStandardMaterialParameters => ({ map: p.map, ...(p.bump ? { bumpMap: p.bump, bumpScale: p.bumpScale ?? 1 } : {}) });
/** a planar canvas (dial, cover, plate) as a texture */
function canvasTex(c: Canvas3, data = false): THREE.Texture {
  const t = data ? c.bump(false) : c.map(false);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/**
 * The studio that metal and glass mirror (an HDR panorama for PMREM): a bright window up and to the left in front, a
 * cool softbox to the right, warm walls, a darker band at the horizon and a warm wooden floor, so brass shows real
 * contrast (gleaming tops, dark bands, warm undersides) instead of a flat yellow.
 */
export function studioEnv(R: THREE.WebGLRenderer, night = false): THREE.Texture {
  const W = 128, H = 64, d = new Float32Array(W * H * 4);
  const win = new THREE.Vector3(-0.55, 0.55, 0.62).normalize(), box = new THREE.Vector3(0.8, 0.25, 0.55).normalize(), back = new THREE.Vector3(0.2, 0.5, -0.8).normalize();
  const v3 = new THREE.Vector3();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const lat = ((j + 0.5) / H - 0.5) * Math.PI, lon = ((i + 0.5) / W - 0.5) * Math.PI * 2;
    v3.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    const y = v3.y;
    let c: [number, number, number];
    if (y < -0.12) c = [0.32, 0.19, 0.11]; // the floor
    else if (y < 0.06) c = [0.1, 0.08, 0.09]; // the horizon band
    else c = [0.55 + y * 0.35, 0.46 + y * 0.35, 0.4 + y * 0.38]; // walls, brighter up towards the ceiling
    if (night) c = [c[0] * 0.45, c[1] * 0.5, c[2] * 0.75];
    const w = v3.dot(win), b = v3.dot(box), r = v3.dot(back);
    if (w > 0.93) { const k = night ? [1.2, 1.4, 2.2] : [5.5, 5.0, 4.2]; c = [k[0], k[1], k[2]]; }
    else if (w > 0.85) c = c.map((x) => x * 1.8) as [number, number, number];
    if (b > 0.95) c = night ? [0.6, 0.7, 1.1] : [1.6, 1.8, 2.2];
    if (r > 0.9) c = c.map((x) => x + (night ? 0.4 : 1.0)) as [number, number, number];
    const o = (j * W + i) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 1;
  }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat, THREE.FloatType);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(R);
  const env = pm.fromEquirectangular(t).texture;
  pm.dispose();
  t.dispose();
  return env;
}

// ------------------------------------------------------------------ materials

/** a photo texture for a material: the swatch, its repeats per texture-coordinate unit, the tint it is multiplied by, its relief */
interface Photo { name: Swatch; rep?: number; tint?: number; bump?: number }
type MatOpt = THREE.MeshStandardMaterialParameters & { physical?: THREE.MeshPhysicalMaterialParameters; keep?: boolean; photo?: Photo };
/** materials that wear a photo texture once it is there (or repaint themselves with it) */
const upgrades: (() => boolean)[] = [];
function wearPhoto(m: THREE.MeshStandardMaterial, ph: Photo): boolean {
  const t = swatchAt(ph.name, ph.rep ?? 1);
  if (!t) return false;
  m.map = t; m.bumpMap = t; m.bumpScale = ph.bump ?? 0.6; m.color.setHex(ph.tint ?? 0xffffff);
  m.needsUpdate = true;
  return true;
}
/** put the photo textures on every material that wants one (when the interface atlas has arrived); true if any changed */
export function upgradePhotos(): boolean {
  let any = false;
  for (let i = upgrades.length - 1; i >= 0; i--) if (upgrades[i]()) { upgrades.splice(i, 1); any = true; }
  return any;
}
const matCache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}
/** a lit material, its textures laid on by `fitUV` unless `keep` (its own planar coordinates); `photo` a photo texture */
function std(key: string, o: MatOpt): THREE.MeshStandardMaterial {
  return cached(key, () => {
    const { physical, keep, photo, ...rest } = o;
    const m = physical ? new THREE.MeshPhysicalMaterial({ ...rest, ...physical }) : new THREE.MeshStandardMaterial(rest);
    if (keep) keepUV(m);
    m.userData.shelfMat = true;
    if (photo && !wearPhoto(m, photo)) upgrades.push(() => wearPhoto(m, photo));
    return m;
  });
}
const painted = new Map<string, Painted>();
function leatherPainted(base: string, seed: number): Painted {
  let p = painted.get(base + seed);
  if (!p) { const c = leatherCanvas(base, { seed }); p = { map: c.map(), bump: c.bump(), bumpScale: 0.4 }; painted.set(base + seed, p); }
  return p;
}
/** the shared wood textures (each painted once, tinted per part) */
const WALNUT = () => wood('#7b4522', { seed: 3, knots: 1 }), WALNUT_DK = () => wood('#5e3018', { seed: 7, knots: 1 }), OAKW = () => wood('#c08844', { seed: 5 });
/** the shared gold texture */
const GOLD = () => metal('#f0c450', { seed: 9, patina: 0.04 });
/** the shared materials (one instance each) */
export const MATS = {
  brass: () => std('brass', { ...pm(metal('#d0a03a', { seed: 2, patina: 0.28 })), metalness: 0.72, roughness: 0.34, envMapIntensity: 0.85 }),
  /** turned brass with engraved bands and a twisted rope */
  brassEngr: () => std('brassEngr', { ...pm(metal('#d4a63c', { seed: 4, patina: 0.22, engrave: 'rings', brush: 'u' })), metalness: 0.72, roughness: 0.32, envMapIntensity: 0.9 }),
  brassDark: () => std('brassDark', { ...pm(metal('#8a6224', { seed: 7, patina: 0.5 })), metalness: 0.8, roughness: 0.42, envMapIntensity: 1.0 }),
  gold: () => std('gold', { ...pm(GOLD()), metalness: 0.78, roughness: 0.26, envMapIntensity: 0.95 }),
  steel: () => std('steel', { ...pm(metal('#4a4652', { seed: 12, patina: 0 })), metalness: 0.6, roughness: 0.35, envMapIntensity: 0.9 }),
  blued: () => std('blued', { ...pm(metal('#2a3874', { seed: 13, patina: 0 })), metalness: 0.7, roughness: 0.28, envMapIntensity: 1.1 }),
  red: () => std('redHand', { ...pm(enamel('#d8282c', { craze: 0.6 })), roughness: 0.35 }),
  walnut: () => std('walnut', { ...pm(WALNUT()), roughness: 0.5, envMapIntensity: 0.6, photo: { name: 'woodg', tint: 0x80482a }, physical: { clearcoat: 0.35, clearcoatRoughness: 0.35 } }),
  oak: () => std('oak', { ...pm(OAKW()), roughness: 0.55, photo: { name: 'wood', tint: 0xffe8cc } }),
  leather: () => std('leather', { ...pm(leatherPainted('#80222c', 3)), roughness: 0.58, photo: { name: 'grain', rep: 1.6, tint: 0xa8303a, bump: 0.8 }, physical: { sheen: 0.4, sheenColor: new THREE.Color(0xd08070), sheenRoughness: 0.5 } }),
  paper: () => std('paper', { map: paperCanvas('#efe2bf').map(), roughness: 0.92 }),
  ink: () => std('ink', { ...pm(enamel('#2a1c24', { craze: 0, size: 32 })), roughness: 0.5 }),
  /** dielectric gloss added on top of a surface: the reflections and glints of glass, nothing else */
  glassSpec: () => cached('glassSpec', () => new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, envMapIntensity: 4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })),
};

// ------------------------------------------------------------------ modelling helpers

type P2 = [number, number];

export type O = THREE.Object3D;
export const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, cast = true): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.castShadow = cast;
  me.receiveShadow = true;
  return me;
}
export function grp(...ch: O[]): THREE.Group { const g = new THREE.Group(); for (const c of ch) g.add(c); return g; }
export function at<T extends O>(o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1): T {
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  if (Array.isArray(s)) o.scale.set(s[0], s[1], s[2]); else o.scale.setScalar(s);
  return o;
}
export const shape = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => V2(x, y)));
export function circlePts(r: number, n = 48, cx = 0, cy = 0): [number, number][] { return Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]); }
export function starPts(R: number, r: number, n = 5, rot = Math.PI / 2): [number, number][] { return Array.from({ length: n * 2 }, (_, i) => { const a = rot + (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r : R; return [Math.cos(a) * rr, Math.sin(a) * rr]; }); }
/** a rounded rectangle path */
export function rrectPts(w: number, h: number, r: number, n = 6): [number, number][] {
  const pts: [number, number][] = [];
  const cs: [number, number, number][] = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}
/** a crescent: the disc of radius R minus a disc of radius `cut` at `off` */
export function crescentPts(R: number, cut: number, off: [number, number], n = 96): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R; if (Math.hypot(x - off[0], y - off[1]) > cut) pts.push([x, y]); }
  const inner: [number, number][] = [];
  for (let i = n; i >= 0; i--) { const a = (i / n) * Math.PI * 2, x = off[0] + Math.cos(a) * cut, y = off[1] + Math.sin(a) * cut; if (Math.hypot(x, y) < R) inner.push([x, y]); }
  // start the outline where the two arcs meet so it closes cleanly
  const k = pts.findIndex((_, i) => i > 0 && Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) > (2 * Math.PI * R) / n * 1.6);
  const outer = k > 0 ? [...pts.slice(k), ...pts.slice(0, k)] : pts;
  return [...outer, ...inner];
}
/** planar (XY) texture coordinates over the geometry's bounds: a texture lies flat on the front */
export function planarUV(g: THREE.BufferGeometry, pad = 0): THREE.BufferGeometry {
  g.computeBoundingBox();
  const b = g.boundingBox!, sx = b.max.x - b.min.x + pad * 2 || 1, sy = b.max.y - b.min.y + pad * 2 || 1;
  const p = g.attributes.position as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - b.min.x + pad) / sx; uv[i * 2 + 1] = (p.getY(i) - b.min.y + pad) / sy; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
/** an extruded 2D shape with a rounded bevel, centred on z */
export function ext(sh: THREE.Shape | THREE.Shape[], depth: number, m: THREE.Material, bevel = 0.04, segs = 3, curve = 24): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: segs, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return mesh(g, m);
}
/** a surface of revolution about y from (radius, y) pairs */
export function lathe(pts: [number, number][], m: THREE.Material, seg = 40): THREE.Mesh {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(0.0001, r), y)), seg);
  g.computeVertexNormals();
  return mesh(g, m);
}
/** a smooth lathe profile: control points rounded with a Catmull-Rom spline */
export function smoothProfile(pts: [number, number][], n = 4): [number, number][] {
  const c = new THREE.SplineCurve(pts.map(([r, y]) => V2(r, y)));
  return c.getPoints(pts.length * n).map((p) => [p.x, p.y]);
}
export function tube(pts: [number, number, number][], r: number, m: THREE.Material, seg = 32, rad = 8, closed = false): THREE.Mesh {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  return mesh(new THREE.TubeGeometry(c, seg, r, rad, closed), m);
}
export function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 24): THREE.Mesh { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }
export function torus(R: number, r: number, m: THREE.Material, arc = Math.PI * 2, rs = 10, ts = 40): THREE.Mesh { return mesh(new THREE.TorusGeometry(R, r, rs, ts, arc), m); }
export function ball(r: number, m: THREE.Material, w = 16, h = 12): THREE.Mesh { return mesh(new THREE.SphereGeometry(r, w, h), m); }
/**
 * A flat ribbon (or strap) of width w following a path. `normal` fixes the face's normal (a ribbon lying on a
 * surface); or `across` fixes the direction the width runs (a strap wrapped round a book).
 */
export function ribbon(pts: [number, number, number][], w: number, m: THREE.Material, o: { normal?: [number, number, number]; across?: [number, number, number]; seg?: number; lift?: number } = {}): THREE.Mesh {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const seg = o.seg ?? 24, P: number[] = [], N: number[] = [], U: number[] = [], I: number[] = [];
  const nFix = new THREE.Vector3(...(o.normal ?? [0, 1, 0])).normalize(), aFix = o.across ? new THREE.Vector3(...o.across).normalize() : null;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = c.getPointAt(t), tg = c.getTangentAt(t);
    let side: THREE.Vector3, nrm: THREE.Vector3;
    if (aFix) { side = aFix.clone().addScaledVector(tg, -aFix.dot(tg)).normalize(); nrm = new THREE.Vector3().crossVectors(tg, side).normalize(); }
    else { side = new THREE.Vector3().crossVectors(tg, nFix).normalize(); nrm = new THREE.Vector3().crossVectors(side, tg).normalize(); }
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(side, (s * w) / 2).addScaledVector(nrm, o.lift ?? 0);
      P.push(q.x, q.y, q.z); N.push(nrm.x, nrm.y, nrm.z); U.push((s + 1) / 2, t);
    }
    if (i < seg) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  return mesh(g, m);
}

// ------------------------------------------------------------------ a tiny pixel numeral font for dials
const DIGIT: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};
function digitsAt(t: string, cx: number, cy: number, g: number): (x: number, y: number) => boolean {
  const w = t.length * 4 * g - g, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - 2.5 * g);
  return (x, y) => {
    const i = Math.floor((x - x0) / (4 * g)), dx = Math.floor(((x - x0) % (4 * g)) / g), dy = Math.floor((y - y0) / g);
    if (x < x0 || i < 0 || i >= t.length || dx > 2 || dy < 0 || dy > 4) return false;
    return DIGIT[t[i]]?.[dy][dx] === '1';
  };
}

// ------------------------------------------------------------------ [icons9] the oil lamp (the Sleep button)

export interface OilLampParts { root: THREE.Group; body: THREE.Group; flame: THREE.Group; knob: O; setGlow: (g: number) => void; flameAt: THREE.Vector3; height: number }
/**
 * A bedside oil lamp: an engraved brass foot with a finger loop, a ruby glass font holding the oil, a brass burner with
 * its gallery of prongs and a knurled wick wheel, a clear glass chimney bulging round a warm teardrop flame.
 */
export function oilLamp(dens = SHELF_DENSITY): OilLampParts {
  const B = MATS.brass(), BE = MATS.brassEngr(), G = MATS.gold();
  const foot = lathe(smoothProfile([[0, 0], [0.46, 0], [0.5, 0.015], [0.52, 0.05], [0.49, 0.085], [0.41, 0.1], [0.38, 0.13], [0.28, 0.17], [0.19, 0.23], [0.15, 0.29], [0.15, 0.33]], 3), BE, 48);
  const loop = at(torus(0.11, 0.026, B, Math.PI * 1.45, 8, 24), 0.5, 0.17, 0, 0, 0, -Math.PI * 0.72);
  const rubyM = std('lampFont', { color: 0x8c1628, roughness: 0.12, metalness: 0.1, envMapIntensity: 1.5, emissive: 0x3a0610, emissiveIntensity: 0.5, keep: true });
  const font = lathe(smoothProfile([[0.15, 0.32], [0.3, 0.36], [0.43, 0.45], [0.48, 0.55], [0.46, 0.64], [0.36, 0.73], [0.22, 0.78], [0.17, 0.8]], 4), rubyM, 48);
  const beads = grp();
  const beadGeo = new THREE.SphereGeometry(0.022, 8, 6);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; const b = mesh(beadGeo, G); b.position.set(Math.cos(a) * 0.49, 0.55, Math.sin(a) * 0.49); beads.add(b); }
  const collar = lathe(smoothProfile([[0.17, 0.79], [0.21, 0.81], [0.22, 0.86], [0.2, 0.9], [0.25, 0.93], [0.25, 0.96], [0.2, 0.96]], 3), BE, 40);
  const prongs = grp();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; prongs.add(at(cyl(0.012, 0.016, 0.09, B, 6), Math.cos(a) * 0.235, 0.99, Math.sin(a) * 0.235, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12)); }
  const knob = grp(at(cyl(0.018, 0.018, 0.2, B, 8), 0.3, 0.86, 0.1, 0, 0, Math.PI / 2), at(cyl(0.075, 0.075, 0.03, G, 18), 0.41, 0.86, 0.1, 0, 0, Math.PI / 2), at(cyl(0.04, 0.04, 0.045, B, 12), 0.41, 0.86, 0.1, 0, 0, Math.PI / 2));
  // the chimney: clear glass, a bulb round the flame and a tall neck with a crimped lip
  const glassM = std('lampGlass', { color: 0xfff6e4, roughness: 0.03, metalness: 0, envMapIntensity: 1.2, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, keep: true });
  const chimney = lathe(smoothProfile([[0.2, 0.95], [0.23, 1.0], [0.31, 1.12], [0.34, 1.23], [0.31, 1.35], [0.21, 1.47], [0.165, 1.57], [0.165, 1.72], [0.19, 1.76], [0.2, 1.78]], 3), glassM, 40);
  chimney.renderOrder = 3;
  // the flame: the wick, a teardrop of warm light with a bright heart (unlit: it glows)
  const outerM = new THREE.MeshBasicMaterial({ color: 0xffa83a, toneMapped: false }), innerM = new THREE.MeshBasicMaterial({ color: 0xfff8d8, toneMapped: false });
  outerM.userData.pix = { glow: true }; innerM.userData.pix = { glow: true };
  const tear = (k: number, m: THREE.Material) => lathe(smoothProfile([[0, 0], [0.06 * k, 0.03 * k], [0.075 * k, 0.1 * k], [0.055 * k, 0.2 * k], [0.022 * k, 0.29 * k], [0, 0.34 * k]], 3), m, 20);
  const flame = grp(tear(1.35, outerM), at(tear(0.75, innerM), 0, 0.015, 0.03));
  flame.position.set(0, 1.0, 0);
  const wick = at(cyl(0.028, 0.03, 0.05, std('wick', { color: 0x2a2018, roughness: 0.9 }), 8), 0, 0.98, 0);
  const haloT = paintTex('lamphalo', 32, 32, (x, y) => { const r = Math.hypot(x - 15.5, y - 15.5) / 15.5; return [255, 255, 255, clamp(1 - r) ** 1.8 * 255]; }, { data: true, smooth: true });
  const haloM = keepUV(new THREE.MeshBasicMaterial({ color: 0xffc870, alphaMap: haloT, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = at(mesh(new THREE.PlaneGeometry(1.1, 1.1), haloM, false), 0, 1.15, -0.3);
  halo.name = 'halo';
  halo.renderOrder = 2;
  const body = grp(foot, loop, font, beads, collar, prongs, knob, wick, flame, chimney, halo);
  const root = grp(body);
  fitUV(root, dens);
  const setGlow = (g: number) => {
    flame.visible = g > 0.1;
    flame.scale.set(0.85 + 0.15 * Math.min(1.4, g), 0.7 + 0.35 * Math.min(1.6, g), 0.85 + 0.15 * Math.min(1.4, g));
    haloM.opacity = 0.06 + 0.14 * g;
    rubyM.emissiveIntensity = 0.3 + 0.4 * Math.min(1.5, g);
  };
  setGlow(0.8);
  return { root, body, flame, knob, setGlow, flameAt: new THREE.Vector3(0, 1.14, 0), height: 1.8 };
}

// ------------------------------------------------------------------ the cuckoo clock

export interface ClockParts { root: THREE.Group; body: THREE.Group; hour: O; minute: O; pendulum: O; door: O; owl: THREE.Group; weights: O[]; height: number }

/** Roman numerals as painted brush strokes (no font needed): glyph `t` centred at (0, 0), `h` tall, upright */
function romanStrokes(g: CanvasRenderingContext2D, t: string, h: number) {
  const w1 = h * 0.16, wV = h * 0.5, gap = h * 0.1;
  const widths = [...t].map((c) => (c === 'I' ? w1 : wV));
  let x = -(widths.reduce((a, b) => a + b, 0) + gap * (t.length - 1)) / 2;
  g.lineCap = 'butt';
  for (const [i, c] of [...t].entries()) {
    const w = widths[i], top = -h / 2, bot = h / 2;
    g.lineWidth = h * 0.19;
    g.beginPath();
    if (c === 'I') { g.moveTo(x + w / 2, top); g.lineTo(x + w / 2, bot); }
    else if (c === 'V') { g.moveTo(x, top); g.lineTo(x + w / 2, bot); g.moveTo(x + w, top); g.lineTo(x + w / 2, bot); }
    else { g.moveTo(x, top); g.lineTo(x + w, bot); g.moveTo(x + w, top); g.lineTo(x, bot); }
    g.stroke();
    // serifs top and bottom
    g.lineWidth = h * 0.07;
    g.beginPath(); g.moveTo(x - h * 0.06, top); g.lineTo(x + w + h * 0.06, top); g.moveTo(x - h * 0.06, bot); g.lineTo(x + w + h * 0.06, bot); g.stroke();
    x += w + gap;
  }
}
/**
 * The dial: cream enamel with soft brushwork and fine crazing, a painted minute track, Roman numerals turned to the
 * centre, a red and gold painted rosette at the arbor and a little red crescent maker's mark.
 */
function dialTex(): THREE.Texture {
  const N = 256, c = N / 2, R = ramp('#f0e6cc');
  const cv = new Canvas3(N, N);
  const craze = enamelCrazeAt(N);
  cv.each((x, y) => {
    const r = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
    const v = 0.35 - r * 0.32 + (noise(x * 1.6, y * 1.6, 8) - 0.5) * 0.7 + (craze(x, y) ? -0.16 : 0);
    return r > 0.96 ? [176, 140, 74] : rampAt(R.slice(16, 65), clamp((v + 0.5) / 1.1));
  });
  const g = cv.g, ink = 'rgb(42,28,36)';
  g.translate(c, c);
  g.scale(N / 256, N / 256);
  g.strokeStyle = ink; g.fillStyle = ink;
  // the minute track: two rings and sixty ticks (thicker at the hours)
  g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 101, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, k = i % 5 === 0;
    g.lineWidth = k ? 4 : 2;
    g.beginPath(); g.moveTo(Math.sin(a) * 101, -Math.cos(a) * 101); g.lineTo(Math.sin(a) * (k ? 116 : 112), -Math.cos(a) * (k ? 116 : 112)); g.stroke();
  }
  // the numerals, their feet towards the centre
  const ROM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.save(); g.rotate(a); g.translate(0, -80); romanStrokes(g, ROM[i], 34); g.restore();
  }
  // a painted rosette at the centre: six red petals, gold heart
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.fillStyle = 'rgb(184,40,44)'; g.beginPath(); g.ellipse(Math.sin(a) * 13, -Math.cos(a) * 13, 6, 10, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgb(232,184,64)'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
  // the maker's mark: a little red crescent and two dots
  g.fillStyle = 'rgb(184,40,44)';
  g.beginPath(); g.arc(0, 44, 11, 0, Math.PI * 2); g.arc(5, 40, 9.5, 0, Math.PI * 2, true); g.fill('evenodd');
  g.setTransform(1, 0, 0, 1, 0, 0);
  return canvasTex(cv);
}
/** fine crazing in a glaze: thin cracks between irregular cells */
function enamelCrazeAt(N: number): (x: number, y: number) => boolean {
  return (x, y) => {
    const fx = x / (N / 8), fy = y / (N / 8), ci = Math.floor(fx), cj = Math.floor(fy);
    let d1 = 9, d2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj, px = i + hash(i, j, 41), py = j + hash(i, j, 42), d = Math.hypot(fx - px, fy - py);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return d2 - d1 < 0.07;
  };
}
/** a clock hand shape pointing up +y from the arbor */
function handShape(kind: 'hour' | 'minute' | 'second' | 'alarm'): THREE.Shape {
  if (kind === 'hour') return shape([[-0.035, -0.08], [0.035, -0.08], [0.025, 0.18], [0.07, 0.24], [0.0, 0.34], [-0.07, 0.24], [-0.025, 0.18]]);
  if (kind === 'minute') return shape([[-0.028, -0.1], [0.028, -0.1], [0.018, 0.4], [0.045, 0.44], [0.0, 0.53], [-0.045, 0.44], [-0.018, 0.4]]);
  if (kind === 'alarm') return shape([[-0.018, -0.04], [0.018, -0.04], [0.014, 0.3], [0.05, 0.3], [0.0, 0.4], [-0.05, 0.3], [-0.014, 0.3]]);
  return shape([[-0.04, -0.17], [0.04, -0.17], [0.012, -0.1], [0.008, 0.56], [0.0, 0.6], [-0.008, 0.56], [-0.012, -0.1]]);
}
/** the carved oak leaves: oak with a carved midrib and veins (laid flat on each leaf) */
export const carvedOak = () => std('carvedLeaf', { ...pm(leafTex('#c08a48', { carved: true, seed: 9 })), roughness: 0.6, envMapIntensity: 0.5, keep: true });
/** a carved oak leaf, base at the origin pointing up +y: lobed edges, extruded with a rounded bevel */
export function carvedLeaf(len: number, m: THREE.Material = carvedOak(), wid = 0.38): THREE.Mesh {
  const L: P2[] = [], Rr: P2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, w = Math.max(0.002, Math.sin(Math.PI * Math.pow(t, 0.8)) * len * wid * (1 + 0.3 * Math.abs(Math.sin(t * Math.PI * 4.5))));
    L.push([-w, t * len]); Rr.push([w, t * len]);
  }
  const me = ext(shape([...Rr, ...L.reverse()]), len * 0.06, m, len * 0.05, 2, 8);
  const p = me.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - Math.abs(p.getX(i)) * 0.4 + Math.sin((p.getY(i) / len) * Math.PI) * len * 0.08);
  me.geometry.computeVertexNormals();
  planarUV(me.geometry);
  return me;
}
/** the tiny owl that lives behind the cuckoo door: barred tawny feathers, a pale speckled chest */
function cuckooOwl(): THREE.Group {
  const feather = std('owlFeather', { ...pm(feathers('#b08058', { seed: 12, tip: '#5a3420' })), roughness: 0.75 });
  const belly = std('owlBelly', { ...pm(feathers('#f4e2c4', { seed: 13, tip: '#a87a50', size: 32 })), roughness: 0.8 });
  const body = lathe(smoothProfile([[0, 0], [0.07, 0.01], [0.1, 0.06], [0.1, 0.13], [0.085, 0.19], [0.05, 0.22], [0, 0.225]], 3), feather, 20);
  const chest = at(lathe(smoothProfile([[0, 0.01], [0.06, 0.03], [0.07, 0.08], [0.05, 0.13], [0, 0.14]], 2), belly, 14), 0, 0.01, 0.035, 0, 0, 0, [1, 1, 0.7]);
  const eyeW = std('owlEyeW', { ...pm(enamel('#fff6dc', { craze: 0, chips: false, size: 32 })), roughness: 0.3 }), eyeI = std('owlEyeI', { ...pm(enamel('#f0a020', { craze: 0, chips: false, size: 32 })), roughness: 0.25, emissive: 0x6a3a00, emissiveIntensity: 0.4 }), pupil = MATS.ink();
  const glint = std('glint', { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 });
  const eye = (s: number): THREE.Group => {
    const e = grp(at(cyl(0.04, 0.04, 0.02, eyeW, 14), 0, 0, 0, Math.PI / 2), at(cyl(0.026, 0.026, 0.022, eyeI, 12), 0, 0, 0.004, Math.PI / 2), at(cyl(0.014, 0.014, 0.024, pupil, 10), 0, 0, 0.008, Math.PI / 2), at(ball(0.006, glint, 6, 4), -0.008, 0.01, 0.022));
    e.position.x = s * 0.042;
    return e;
  };
  const beak = at(cyl(0.0, 0.018, 0.05, std('beak', { ...pm(enamel('#f0b030', { craze: 0, size: 32 })), roughness: 0.4 }), 8), 0, 0.125, 0.09, Math.PI / 2 + 0.4);
  const tufts = [-1, 1].map((s) => at(cyl(0.0, 0.025, 0.07, feather, 6), s * 0.06, 0.23, 0.0, 0, 0, -s * 0.5));
  const face = grp(eye(-1), eye(1));
  face.position.set(0, 0.155, 0.08);
  return grp(body, chest, face, beak, ...tufts);
}
/** a cast pine-cone weight: overlapping scales in dark bronze */
function pineCone(m: THREE.Material): THREE.Group {
  const cone = lathe(smoothProfile([[0, -0.2], [0.04, -0.18], [0.075, -0.1], [0.085, 0.0], [0.08, 0.08], [0.05, 0.13], [0, 0.14]], 3), m, 16);
  const ridge = grp();
  for (let r = 0; r < 5; r++) { const y = -0.15 + r * 0.06, rad = [0.05, 0.075, 0.087, 0.083, 0.06][r]; ridge.add(at(torus(rad, 0.013, m, Math.PI * 2, 5, 14), 0, y, 0, Math.PI / 2)); }
  return grp(cone, ridge, at(torus(0.025, 0.008, MATS.brass(), Math.PI * 2, 5, 10), 0, 0.16, 0));
}
/**
 * A Black Forest cuckoo clock on a little carved stand: a steep shingled roof with carved oak-leaf bargeboards and a
 * crest, a cuckoo door (an owl lives behind it), an enamel dial in a wreath of carved leaves with the real time, a
 * scalloped apron, a carved-leaf pendulum and two pine-cone weights on brass chains hanging between turned posts.
 */
export function cuckooClock(dens = SHELF_DENSITY): ClockParts {
  const D = std('walnutDark', { ...pm(WALNUT_DK()), roughness: 0.55, envMapIntensity: 0.5, photo: { name: 'woodg', tint: 0x6a3a22 } });
  const W = MATS.walnut(), OAK = std('carveOak', { ...pm(OAKW()), roughness: 0.6, envMapIntensity: 0.5, photo: { name: 'wood', tint: 0xfff0dc } });
  const ROOF = std('roofShingle', { ...pm(shingles('#6e3a1e', 18)), roughness: 0.75, envMapIntensity: 0.4 });
  const B = MATS.brass(), G = MATS.gold();
  const y0 = 0.62, hw = 0.72, eave = 0.9, peak = 1.45; // the case's floor, half width, eaves and ridge heights
  // the stand: a plinth and two turned posts
  const plinth = at(ext(shape(rrectPts(1.5, 0.12, 0.04)), 0.62, D, 0.025, 2), 0, 0.075, -0.06);
  const postProf = smoothProfile([[0.075, 0], [0.1, 0.03], [0.065, 0.07], [0.055, 0.16], [0.09, 0.24], [0.055, 0.32], [0.052, 0.4], [0.085, 0.44], [0.09, 0.47], [0.075, 0.49]], 3);
  const posts = [-1, 1].map((s) => at(lathe(postProf, D, 14), s * 0.6, 0.135, -0.2));
  // the case: a gabled house
  const caseM = ext(shape([[-hw, 0], [hw, 0], [hw, eave], [0, peak], [-hw, eave]]), 0.46, W, 0.03, 2);
  caseM.position.set(0, y0, -0.08);
  // the roof boards (shingled on top) sit on the gables, overhanging the eaves; carved oak leaves hang from the outer
  // eaves; a crest of leaves on the ridge
  const ex = hw, ey = peak - eave, len = Math.hypot(ex, ey), ang = Math.atan2(ey, ex), nx = -ey / len, ny = ex / len;
  const roof = [-1, 1].map((s) => at(ext(shape(rrectPts(len + 0.24, 0.08, 0.03)), 0.66, ROOF, 0.02, 2), s * (ex / 2 + 0.06 * Math.cos(ang) - nx * 0.05), y0 + eave + ey / 2 - 0.06 * Math.sin(ang) + ny * 0.05, -0.06, 0, 0, -s * ang));
  // the shingle rows run along the eaves: turn the boards' texture coordinates a quarter
  for (const r of roof) { const uv = r.geometry.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setXY(i, uv.getY(i), u); } }
  const barge = grp();
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const t = 0.38 + i * 0.2, x = s * t * (ex + 0.12), y = y0 + peak - t * (ey + 0.09) - 0.02;
    barge.add(at(carvedLeaf(0.19), x, y, 0.29, 0, 0, Math.PI + s * (0.4 + i * 0.06)));
  }
  const crest = grp(at(carvedLeaf(0.22), -0.07, y0 + peak + 0.02, 0.22, 0, 0, 0.6), at(carvedLeaf(0.22), 0.07, y0 + peak + 0.02, 0.22, 0, 0, -0.6), at(carvedLeaf(0.26), 0, y0 + peak + 0.04, 0.2, 0, 0, 0));
  // the cuckoo door in the gable: a dark opening, a framed little door on its hinge, the owl behind it
  const doorShape = shape([[-0.15, 0], [0.15, 0], ...Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * 0.15, 0.17 + Math.sin(a) * 0.12] as P2; })]);
  const doorY = y0 + eave + 0.04;
  const hole = at(ext(doorShape, 0.02, std('hole', { ...pm(WALNUT_DK()), color: 0x503028, roughness: 0.9, photo: { name: 'woodg', tint: 0x2a1610 } }), 0.0, 1, 12), 0, doorY, 0.155);
  const doorM = ext(doorShape, 0.03, OAK, 0.012, 1, 12);
  doorM.position.x = 0.15;
  const door = grp(doorM, at(ball(0.018, G, 6, 4), 0.25, 0.12, 0.028));
  door.position.set(-0.15, doorY, 0.19);
  const frameM = std('doorFrame', { ...pm(WALNUT_DK()), color: 0xe0c8c0, roughness: 0.6, photo: { name: 'woodg', tint: 0x7a4428 } });
  const doorFrame = grp(at(torus(0.165, 0.026, frameM, Math.PI, 6, 16), 0, doorY + 0.17, 0.18), ...[-1, 1].map((s) => at(cyl(0.026, 0.026, 0.17, frameM, 6), s * 0.165, doorY + 0.085, 0.18)), at(ext(shape(rrectPts(0.42, 0.04, 0.015)), 0.08, frameM, 0.01, 1), 0, doorY - 0.01, 0.17));
  const owl = cuckooOwl();
  owl.scale.setScalar(1.15);
  owl.position.set(0, doorY + 0.01, 0.0);
  // the dial in a wreath of carved leaves
  const dialY = y0 + 0.45, dr = 0.38;
  const dial = at(mesh(planarUV(new THREE.CircleGeometry(dr, 48)), std('cuckooDial', { map: dialTex(), roughness: 0.3, keep: true, physical: { clearcoat: 0.5, clearcoatRoughness: 0.2 } }), false), 0, dialY, 0.2);
  dial.name = 'dial';
  const bezel = at(torus(dr + 0.012, 0.026, B, Math.PI * 2, 8, 48), 0, dialY, 0.2);
  const wreath = grp();
  for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2 + 0.3; wreath.add(at(carvedLeaf(0.17, undefined, 0.34), Math.cos(a) * (dr + 0.03), dialY + Math.sin(a) * (dr + 0.03), 0.17, 0, 0, a - Math.PI / 2)); }
  const handMesh = (k: 'hour' | 'minute', z: number, sc: number) => { const h = ext(handShape(k), 0.01, MATS.blued(), 0.005, 1, 8); h.castShadow = false; h.scale.setScalar(sc); const p = grp(h); p.position.set(0, dialY, z); return p; };
  const hour = handMesh('hour', 0.225, 0.78), minute = handMesh('minute', 0.235, 0.7);
  const arbor = at(lathe([[0, 0.025], [0.03, 0.015], [0.035, 0], [0, 0]], G, 12), 0, dialY, 0.245, Math.PI / 2);
  // the scalloped apron under the case
  const apronPts: P2[] = [[-hw - 0.02, 0.08]];
  for (let i = 0; i <= 40; i++) { const x = -hw - 0.02 + (i / 40) * (hw + 0.02) * 2; apronPts.push([x, -0.02 - Math.abs(Math.sin((x / (hw + 0.02)) * Math.PI * 2.5)) * 0.07]); }
  apronPts.push([hw + 0.02, 0.08]);
  const apron = at(ext(shape(apronPts), 0.04, OAK, 0.012, 1), 0, y0 - 0.02, 0.17);
  // the pendulum (a carved leaf on a rod) and the two pine-cone weights on chains
  const pendulum = grp(at(cyl(0.011, 0.011, 0.26, B, 6), 0, -0.13, 0), at(carvedLeaf(0.17, undefined, 0.42), 0, -0.25, 0.01, 0, 0, Math.PI));
  pendulum.position.set(0, y0 - 0.06, 0.1);
  const iron = std('coneIron', { ...pm(scales('#8a6a44', 13)), metalness: 0.55, roughness: 0.45, envMapIntensity: 0.8 });
  const chainBead = new THREE.SphereGeometry(0.013, 6, 4);
  const weights = [-1, 1].map((s, i) => {
    const len2 = i ? 0.08 : 0.16, g = grp();
    for (let k = 0; k < len2 / 0.04; k++) { const b = mesh(chainBead, B, false); b.position.set(0, -k * 0.04, 0); g.add(b); }
    g.add(at(pineCone(iron), 0, -len2 - 0.13, 0, 0, 0, 0, 0.85));
    g.position.set(s * 0.3, y0 - 0.06, -0.02);
    return g;
  });
  const body = grp(plinth, ...posts, caseM, ...roof, barge, crest, hole, door, doorFrame, owl, dial, bezel, wreath, hour, minute, arbor, apron, pendulum, ...weights);
  const root = grp(body);
  fitUV(root, dens);
  return { root, body, hour, minute, pendulum, door, owl, weights, height: y0 + peak + 0.3 };
}

/** set the hands to the time `d` */
export function setClockHands(c: ClockParts, d: Date) {
  const h = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
  c.hour.rotation.z = -((h + m / 60) / 12) * Math.PI * 2;
  c.minute.rotation.z = -((m + s / 60) / 60) * Math.PI * 2;
}

// ------------------------------------------------------------------ the leather journal

export interface BookParts { root: THREE.Group; body: THREE.Group; cover: THREE.Group; tab: THREE.Group; ribbon: O; w: number; h: number; t: number }

/**
 * The front cover, laid flat over the board: oxblood leather with its pebbled grain and creases, worn paler at the
 * edges and corners, a running stitch round the edge, a blind-tooled double fillet with a gilt line between, corner
 * fleurons and a tooled lattice panel.
 */
function coverTex(): { map: THREE.Texture; bump: THREE.Texture } {
  const N = 512, cv = new Canvas3(N, N);
  const R = ramp('#8a2430'), G = ramp('#e8b848');
  const g = cv.g;
  // the leather: the photo grain dyed oxblood (or the painted grain until it arrives)
  if (!photoFill(g, 'grain', N, 2, '#b0343e')) g.drawImage(leatherCanvas('#8a2430', { seed: 13, size: 128 }).c, 0, 0, N, N);
  // worn edges: paler, scuffed
  const img = g.getImageData(0, 0, N, N), d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const e = Math.min(x, y, N - 1 - x, N - 1 - y), k = clamp(1 - e / 20) * 0.45 + (e < 28 && hash(x >> 2, y >> 2, 3) > 0.8 ? 0.12 : 0);
    if (k > 0) { const o = (y * N + x) * 4, c = mix([d[o], d[o + 1], d[o + 2]], R[50], k); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; }
  }
  g.putImageData(img, 0, 0);
  g.scale(N / 256, N / 256);
  const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const rect = (i: number, col: string, w: number) => { g.strokeStyle = col; g.lineWidth = w; g.strokeRect(i, i, 256 - i * 2, 256 - i * 2); };
  // the stitched edge
  stitches(g, [[6, 6], [256 - 6, 6], [256 - 6, 256 - 6], [6, 256 - 6], [6, 6]], '#e8cfa0', 6, 4, 2);
  // the tooling: two blind lines and a gilt line between
  rect(16, rgb(R[8], 0.85), 3); rect(28, rgb(R[8], 0.85), 3);
  rect(22, rgb(G[40]), 2.5);
  // corner fleurons: gilt dots and a tooled leaf turned to each corner
  for (const [cx, cy, a] of [[40, 40, 0], [256 - 40, 40, Math.PI / 2], [256 - 40, 256 - 40, Math.PI], [40, 256 - 40, -Math.PI / 2]] as [number, number, number][]) {
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.fillStyle = rgb(R[8], 0.85);
    g.beginPath(); g.ellipse(-4, -4, 9, 4, Math.PI / 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgb(G[44]);
    for (const [dx, dy] of [[6, -6], [-6, 6], [4, 4]]) { g.beginPath(); g.arc(dx, dy, 2.4, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // a blind-tooled lattice panel in the middle
  g.strokeStyle = rgb(R[10], 0.45); g.lineWidth = 2;
  g.save(); g.beginPath(); g.rect(50, 46, 256 - 100, 256 - 92); g.clip();
  for (let k = -256; k < 512; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); }
  g.restore();
  g.strokeStyle = rgb(R[8], 0.8); g.lineWidth = 2.5; g.strokeRect(50, 46, 256 - 100, 256 - 92);
  cv.heightFromColour(1.2);
  return { map: canvasTex(cv), bump: canvasTex(cv, true) };
}
/** fill a canvas with a photo swatch, `n` x `n` tiles, dyed `tint` (multiplied); false if the swatch isn't there yet */
function photoFill(g: CanvasRenderingContext2D, name: Swatch, N: number, n: number, tint?: string): boolean {
  const c = swatchCanvas(name);
  if (!c) return false;
  const t = N / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g.drawImage(c, x * t, y * t, t, t);
  if (tint) { g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = tint; g.fillRect(0, 0, N, N); g.restore(); }
  return true;
}
/** the page block's edges: fine paper leaves (running along v), a little uneven, with a soft gilt wash */
function pageEdgeTex(): THREE.Texture {
  return paintTex('pageedge2', 32, 32, (x, y) => {
    const base = rampAt(PAL.paper, 0.8 + (vnoise(x * 0.5, y * 0.2, 4) - 0.5) * 0.12);
    const leaf = (x + Math.floor(vnoise(0, y * 0.12, 7) * 3)) % 3;
    return leaf === 0 ? mul(base, 0.8) : leaf === 1 ? mix(base, [244, 214, 140], 0.25) : base;
  }, { repeat: true });
}
/** the first page: ruled paper with fibres, a few lines in ink and a little leaf doodle */
function pageFaceTex(): THREE.Texture {
  const cv = paperCanvas('#f4e8cc', { seed: 21, size: 128, ruled: '#9ab4d8', ink: '#3a3060', lines: 10 });
  const g = cv.g;
  g.fillStyle = 'rgb(96,140,60)'; // [icons9] a little leaf doodle in the corner
  g.beginPath(); g.ellipse(100, 20, 9, 4.5, -0.6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgb(60,90,40)'; g.lineWidth = 1; g.beginPath(); g.moveTo(93, 26); g.lineTo(107, 14); g.stroke();
  return canvasTex(cv);
}
function endpaperTex(): THREE.Texture {
  return paintTex('endpaper', 64, 64, (x, y) => {
    const w = fbm(x * 0.05 + fbm(x * 0.04, y * 0.04, 3) * 2.5, y * 0.05, 7, 4);
    const R = [hex('#2a1d4a'), hex('#3c2c6c'), hex('#5a4a8e'), hex('#8a7ab8'), hex('#c8a85a')];
    const v = (Math.sin(w * 22) + 1) / 2;
    return v > 0.93 ? R[4] : rampAt(R.slice(0, 4), v);
  }, { repeat: true });
}
/** the strap: cherry leather with a stitched line down each edge (u across, v along) */
function strapTex(): THREE.Texture {
  const cv = new Canvas3(128, 128);
  if (!photoFill(cv.g, 'leather', 128, 1, '#e08a60')) cv.g.drawImage(leatherCanvas('#a8442a', { seed: 9, size: 64 }).c, 0, 0, 128, 128);
  stitches(cv.g, [[18, -8], [18, 136]], '#f0d8a8', 10, 6, 3);
  stitches(cv.g, [[110, -4], [110, 140]], '#f0d8a8', 10, 6, 3);
  return cv.map();
}
export function journal(dens = SHELF_DENSITY): BookParts {
  const w = 1.56, h = 2.04, t = 0.5, ct = 0.075, r = 0.06;
  const { map, bump } = coverTex();
  const leatherM = std('cover', { map, bumpMap: bump, bumpScale: 0.8, roughness: 0.55, keep: true, physical: { sheen: 0.35, sheenColor: new THREE.Color(0xe09080), sheenRoughness: 0.45 } });
  if (!swatchCanvas('grain')) upgrades.push(() => { if (!swatchCanvas('grain')) return false; const c = coverTex(); leatherM.map = c.map; leatherM.bumpMap = c.bump; leatherM.needsUpdate = true; return true; });
  const plainLeather = MATS.leather();
  const boardGeo = () => { const g = new THREE.ExtrudeGeometry(shape(rrectPts(w, h, r)), { depth: ct - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 6 }); g.translate(0, 0, -(ct - 0.03) / 2); planarUV(g); g.computeVertexNormals(); return g; };
  // the back board, the spine (a rounded back with raised bands) and the page block
  const back = at(mesh(boardGeo(), plainLeather), w / 2, h / 2, -t / 2 + ct / 2);
  const spineR = t / 2;
  const spineM = std('spine', { ...pm(leatherPainted('#7a1e28', 4)), photo: { name: 'grain', rep: 1.6, tint: 0xa8303a, bump: 0.8 }, roughness: 0.58, side: THREE.DoubleSide, physical: { sheen: 0.4, sheenColor: new THREE.Color(0xd08070), sheenRoughness: 0.5 } });
  const spine = at(mesh(new THREE.CylinderGeometry(spineR, spineR, h - 0.01, 24, 1, true, Math.PI, Math.PI), spineM), 0.03, h / 2, 0);
  const bands = [0.28, 0.62, 1.42, 1.76].map((y) => at(torus(spineR + 0.008, 0.028, plainLeather, Math.PI, 6, 18), 0.03, y, 0, Math.PI / 2, 0, Math.PI / 2));
  const edge = pageEdgeTex();
  const pagesM = [std('pageEdgeV', { map: edge, roughness: 0.9 }), std('pageFace', { map: pageFaceTex(), roughness: 0.9, keep: true })];
  const blockGeo = new THREE.BoxGeometry(w - 0.1, h - 0.1, t - ct * 2 - 0.01);
  const pages = at(new THREE.Mesh(blockGeo, [pagesM[0], pagesM[0], pagesM[0], pagesM[0], pagesM[1], pagesM[0]]), 0.01 + (w - 0.1) / 2, h / 2, 0);
  pages.castShadow = true; pages.receiveShadow = true;
  // the page edges: fine leaves running round the block (the box's own coordinates, scaled to the density)
  {
    const uv = blockGeo.attributes.uv as THREE.BufferAttribute, n = blockGeo.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(n.getZ(i)) > 0.5) continue;
      const u = uv.getX(i), v = uv.getY(i);
      if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, u * 1.3, v * h * dens); else uv.setXY(i, v * 1.3, u * w * dens);
    }
  }
  // the front board on its hinge at the spine: tooled leather outside, a marbled endpaper inside, gilt corners
  const front = at(mesh(boardGeo(), leatherM), w / 2, h / 2, 0);
  const endp = at(mesh(new THREE.PlaneGeometry(w - 0.08, h - 0.08), std('endpaper', { map: endpaperTex(), roughness: 0.8 }), false), w / 2, h / 2, -ct / 2 - 0.004, 0, Math.PI, 0);
  const G = MATS.gold();
  const corner = (sx: number, sy: number) => {
    const c = ext(shape([[0, 0], [0.3, 0], [0, 0.3]]), ct + 0.03, G, 0.014, 2, 4);
    const g = grp(c, at(ball(0.022, G, 8, 6), 0.08, 0.08, (ct + 0.03) / 2 + 0.01));
    g.position.set(sx > 0 ? w - 0.02 : 0.02, sy > 0 ? h - 0.02 : 0.02, 0);
    g.rotation.z = sx > 0 ? (sy > 0 ? Math.PI : Math.PI / 2) : sy > 0 ? -Math.PI / 2 : 0;
    return g;
  };
  // [icons9] no emblem: the tooled leather, the gilt corners, the strap and the ribbon carry it
  const coverIn = grp(front, endp, corner(1, 1), corner(1, -1));
  coverIn.position.set(0, 0, 0);
  const cover = grp(coverIn);
  cover.position.set(0, 0, t / 2 - ct / 2);
  // the strap: from the back board round the fore-edge onto the front, its tab held by a brass stud
  const strapT = strapTex();
  const strapM = std('strap', { map: strapT, roughness: 0.55, side: THREE.DoubleSide, keep: true });
  if (!swatchCanvas('leather')) upgrades.push(() => { if (!swatchCanvas('leather')) return false; strapM.map = strapTex(); strapM.needsUpdate = true; return true; });
  const tabMat = std('strapTab', { ...pm(leatherPainted('#a8442a', 9)), roughness: 0.55, photo: { name: 'leather', rep: 2.5, tint: 0xf0a078, bump: 0.6 } });
  const sy = h * 0.36, sw = 0.22;
  const strapBack = ribbon([[w - 0.45, sy, -t / 2 - 0.012], [w - 0.05, sy, -t / 2 - 0.02], [w + 0.05, sy, -t / 2 + 0.04], [w + 0.08, sy, 0], [w + 0.05, sy, t / 2 - 0.02], [w - 0.02, sy, t / 2 + 0.03]], sw, strapM, { across: [0, 1, 0] });
  { const uv = strapBack.geometry.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 1.1 / sw); }
  const tabShape = shape([[0, -sw / 2], [-0.42, -sw / 2], [-0.52, -sw / 2 + 0.03], [-0.55, 0], [-0.52, sw / 2 - 0.03], [-0.42, sw / 2], [0, sw / 2]]);
  const tabM = ext(tabShape, 0.024, tabMat, 0.008, 1, 8);
  const stud = at(lathe(smoothProfile([[0, 0.035], [0.04, 0.03], [0.055, 0.012], [0.05, 0], [0, 0]], 2), G, 16), -0.4, 0, 0.012, Math.PI / 2);
  const tab = grp(tabM, stud, at(ball(0.012, G, 6, 4), -0.48, -0.06, 0.016), at(ball(0.012, G, 6, 4), -0.48, 0.06, 0.016));
  tab.position.set(w - 0.02, sy, t / 2 + 0.03);
  // the satin ribbon: out of the foot of the pages, across the shelf, its end cut in a swallowtail
  const ribM = std('ribbon', { ...pm(cloth('#2f8a52', 'twill', 6)), roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide, photo: { name: 'linen', rep: 3, tint: 0x3aa864, bump: 0.3 } });
  const rib = ribbon([[w * 0.62, 0.06, 0.02], [w * 0.63, 0.012, 0.2], [w * 0.68, 0.008, 0.34], [w * 0.76, 0.01, 0.44], [w * 0.82, 0.008, 0.5]], 0.08, ribM, { lift: 0.004 });
  const tail = at(mesh(new THREE.ShapeGeometry(shape([[-0.04, 0], [0.04, 0], [0.04, 0.09], [0, 0.05], [-0.04, 0.09]])), ribM, false), w * 0.82, 0.009, 0.5, -Math.PI / 2, 0, -0.9);
  const ribbonG = grp(rib, tail);
  const body = grp(back, spine, ...bands, pages, cover, strapBack, tab, ribbonG);
  body.position.set(-w / 2 + 0.05, 0, 0);
  const root = grp(body);
  // the pages' block keeps its own coordinates (set above); everything else at the density
  keepUV(pagesM[0]);
  fitUV(root, dens);
  return { root, body, cover, tab, ribbon: ribbonG, w, h, t };
}

// ------------------------------------------------------------------ the carved shelf

export interface ShelfParts { root: THREE.Group; top: number; front: number; plates: THREE.Mesh[] }

/** a brass name plate: brushed and lightly tarnished, an engraved double border with scrolled ends, verdigris at the rim */
function plateTex(): THREE.Texture {
  const W = 256, H = 56, cv = metalCanvas('#d8aa40', { seed: 11, size: 64, patina: 0.12 });
  const c = new Canvas3(W, H);
  for (let x = 0; x < W; x += 64) c.g.drawImage(cv.c, x, 0);
  const g = c.g, R = ramp('#d8aa40');
  const cut = (draw: () => void, w: number) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.save(); g.translate(1, 1); g.strokeStyle = `rgb(${R[60].map((v) => v | 0).join(',')})`; g.lineWidth = w; draw(); g.stroke(); g.restore();
    g.strokeStyle = `rgb(${R[6].map((v) => v | 0).join(',')})`; g.lineWidth = w; draw(); g.stroke();
  };
  cut(() => { g.beginPath(); g.rect(7, 7, W - 14, H - 14); }, 2);
  cut(() => { g.beginPath(); g.rect(12, 12, W - 24, H - 24); }, 1.6);
  // scrolls at each end
  for (const s of [1, -1]) {
    const x0 = s > 0 ? 24 : W - 24;
    cut(() => { g.beginPath(); g.moveTo(x0, H / 2); g.bezierCurveTo(x0 + s * 10, H / 2 - 14, x0 + s * 22, H / 2 - 4, x0 + s * 16, H / 2 + 2); g.moveTo(x0, H / 2); g.bezierCurveTo(x0 + s * 10, H / 2 + 14, x0 + s * 22, H / 2 + 4, x0 + s * 16, H / 2 - 2); }, 1.8);
  }
  // tarnish and a little verdigris creeping in from the rim
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (e < 6 && vnoise(x * 0.3, y * 0.3, 5) > 0.45) { const o = (y * W + x) * 4, k = (6 - e) / 6 * 0.5, v = mix([d[o], d[o + 1], d[o + 2]], [80, 150, 124], k); d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; }
  }
  g.putImageData(img, 0, 0);
  return canvasTex(c);
}

/**
 * The shelf: `len` long (x), top surface at y = 0; returns the front face's z. `plates` are brass name plates
 * centred at the given x (width pw, height ph, centre height py on the front face).
 */
export function shelf(len: number, o: { plates?: { x: number; y: number; w: number; h: number }[]; bosses?: number[]; dens?: number } = {}): ShelfParts {
  const dens = o.dens ?? SHELF_DENSITY;
  const W = std('shelfWalnut', { ...pm(WALNUT()), roughness: 0.5, envMapIntensity: 0.6, keep: true, photo: { name: 'woodg', tint: 0x80482a }, physical: { clearcoat: 0.35, clearcoatRoughness: 0.35 } });
  const front = 0.3, back = -0.62, H = 0.8;
  // the moulded profile (z, y): a flat top, a rounded nose with a fillet, a flat face, a bead and a cove at the foot
  const prof: [number, number][] = [
    [back, 0], [front - 0.08, 0], [front - 0.02, -0.012], [front + 0.01, -0.05], [front, -0.1], [front - 0.03, -0.12],
    [front - 0.03, -0.17], [front - 0.055, -0.185], [front - 0.03, -0.2],
    [front - 0.03, -H + 0.2], [front - 0.055, -H + 0.185], [front - 0.03, -H + 0.17],
    [front - 0.03, -H + 0.16], [front - 0.01, -H + 0.14], [front + 0.005, -H + 0.1], [front - 0.01, -H + 0.06], [front - 0.04, -H + 0.04], [front - 0.04, -H], [back, -H],
  ];
  const g = new THREE.ExtrudeGeometry(shape(prof), { depth: len, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);
  g.translate(len / 2, 0, 0);
  // world-scale texture coordinates: the grain runs along the shelf on every face
  {
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
    g.computeVertexNormals();
    for (let i = 0; i < p.count; i++) {
      const ny = Math.abs(n.getY(i)), nx = Math.abs(n.getX(i));
      const a = nx > 0.7 ? p.getZ(i) : ny > 0.6 ? p.getZ(i) : p.getY(i);
      uv[i * 2] = a * dens; uv[i * 2 + 1] = (nx > 0.7 ? p.getY(i) : p.getX(i)) * dens;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const plank = mesh(g, W, false);
  const root = grp(plank);
  // carved rosettes between the plates: six rounded petals round a brass stud
  const petals: [number, number][] = Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * Math.PI * 2, r = 0.2 * (0.74 + 0.26 * Math.abs(Math.cos(a * 3))); return [Math.cos(a) * r, Math.sin(a) * r]; });
  for (const x of o.bosses ?? []) {
    const ros = ext(shape(petals), 0.03, MATS.brassEngr(), 0.035, 3, 72);
    ros.castShadow = false;
    root.add(at(ros, x, -H * 0.5, front - 0.01, 0, 0, Math.PI / 6));
    root.add(at(lathe(smoothProfile([[0, 0.05], [0.04, 0.045], [0.06, 0.02], [0.058, 0], [0, 0]], 2), MATS.walnut(), 16), x, -H * 0.5, front + 0.03, Math.PI / 2));
  }
  // brass plates with domed screws
  const plates: THREE.Mesh[] = [];
  const B = std('plate', { map: plateTex(), metalness: 0.78, roughness: 0.32, envMapIntensity: 1.1, keep: true });
  for (const pl of o.plates ?? []) {
    const pg = new THREE.ExtrudeGeometry(shape(rrectPts(pl.w, pl.h, Math.min(0.06, pl.h * 0.25))), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2, curveSegments: 4 });
    planarUV(pg);
    const p = mesh(pg, B, false);
    p.position.set(pl.x, pl.y, front - 0.03 + 0.01);
    plates.push(p);
    root.add(p);
    for (const s of [-1, 1]) root.add(at(lathe(smoothProfile([[0, 0.03], [0.03, 0.025], [0.042, 0.01], [0.04, 0], [0, 0]], 2), MATS.brassDark(), 12), pl.x + s * (pl.w / 2 - 0.09), pl.y, front + 0.02, Math.PI / 2));
  }
  fitUV(root, dens);
  return { root, top: 0, front, plates };
}

// ------------------------------------------------------------------ small details for the shelf top
export function acornProp(s = 1, dens = SHELF_DENSITY): THREE.Group {
  const nut = lathe(smoothProfile([[0, -0.3], [0.08, -0.28], [0.17, -0.18], [0.2, -0.05], [0.19, 0.04], [0.0, 0.06]], 3), std('acornNut', { ...pm(OAKW()), color: 0xffd8a8, photo: { name: 'woodg', rep: 2, tint: 0xe0a050 }, roughness: 0.3, physical: { clearcoat: 0.6, clearcoatRoughness: 0.25 } }), 24);
  const capM = std('acornCap', { ...pm(scales('#7a5030', 23)), roughness: 0.85 });
  const cap = lathe(smoothProfile([[0, 0.17], [0.1, 0.16], [0.19, 0.11], [0.235, 0.04], [0.22, 0.0], [0.18, 0.01], [0, 0.03]], 3), capM, 24);
  const stem = at(cyl(0.018, 0.026, 0.1, capM, 8), 0.01, 0.21, 0, 0, 0, -0.3);
  const g = at(grp(nut, cap, stem), 0, 0, 0, 0, 0, 0, s);
  fitUV(g, dens);
  return g;
}
export function oakLeafProp(s = 1): THREE.Mesh {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = t * Math.PI * 2, y = Math.cos(a) * 0.5;
    const lobes = 1 + 0.28 * Math.sin(t * Math.PI * 2 * 5) ** 2;
    pts.push([Math.sin(a) * 0.2 * lobes * (1 - 0.35 * Math.max(0, -Math.cos(a))), y]);
  }
  const geo = new THREE.ShapeGeometry(shape(pts), 12);
  planarUV(geo);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.25 + Math.sin(p.getY(i) * 3) * 0.02);
  geo.computeVertexNormals();
  const m = std('oakleaf', { ...pm(leafTex('#d27a26', { seed: 5, veins: 6 })), roughness: 0.7, side: THREE.DoubleSide, keep: true });
  const me = mesh(geo, m);
  me.scale.setScalar(s);
  return me;
}
