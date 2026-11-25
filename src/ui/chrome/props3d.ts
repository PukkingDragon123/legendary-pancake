// [icons6] Real 3D interface props: properly shaped, detailed models with realistic hand-painted textures (wood grain
// and knots, brushed brass with a little patina, pebbled and tooled leather, paper fibre, enamel, night glass), shared
// by the live shelf at the bottom of the home screen (shelf3d.tsx) and the icon bake (src/dev/iconbake.ts).
//   moonLamp()   a glass moon lamp on a turned brass base: a crescent moon glowing in a starry glass globe, a bead
//                pull chain
//   alarmClock() a twin-bell brass alarm clock: enamel dial with real hands (hour, minute, ticking second, gold alarm
//                hand), domed glass, bells, hammer, carry handle, splayed feet
//   journal()    a tooled leather journal: gilt corners, a gold moon on the cover, raised spine bands, page block, a
//                satin ribbon, a strap with a brass stud; the cover swings open on its hinge
//   shelf()      a carved walnut shelf: moulded nose, carved scroll ends and acorn rosettes, brass name plates
// Textures are painted per pixel into small canvases (crisp when magnified, mipmapped when shrunk) from the game's
// interface ramps (src/ui/px/relief.ts), with no light baked in: the light comes from the scene.
import * as THREE from 'three';
import { clamp, fbm, hash, hex, leatherGrain, metal, mix, mul, PAL, paperGrain, rampAt, vnoise, weave, woodGrain, type RGB } from '../px/relief.ts';

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
const grey = (v: number): RGB => { const c = clamp(v) * 255; return [c, c, c]; };

/** walnut (or oak) planking, the grain running along v */
export function woodTex(kind: 'walnut' | 'oak' | 'cherry' = 'walnut', seed = 3): THREE.Texture {
  const R = PAL[kind];
  const f = woodGrain(R, { seed, along: 'y', base: kind === 'oak' ? 0.58 : 0.5, contrast: 0.75, scale: 1.6, knots: [[24, 60, 2.4]] });
  return paintTex('wood' + kind + seed, 32, 128, (x, y) => f(x, y, x * 1.0, y * 1.0), { repeat: true });
}
/** brushed brass with tiny pits and a hint of verdigris in the hollows */
export function brassTex(seed = 2, base = 0.62, patina = 0.12): THREE.Texture {
  const f = metal(PAL.brass, { seed, base, brush: 'x', patina });
  return paintTex('brass' + seed + base + patina, 64, 64, (x, y) => f(x, y, x * 0.9, y * 0.9), { repeat: true });
}
/** pebbled leather; `R` a leather ramp */
export function leatherTex(R: RGB[] = PAL.leather, seed = 3): THREE.Texture {
  const f = leatherGrain(R, { seed, base: 0.56 });
  return paintTex('leather' + seed + R[3].join(), 96, 96, (x, y) => f(x, y, x * 0.8, y * 0.8), { repeat: true });
}
/** woven cloth or burlap */
export function clothTex(R: RGB[], seed = 4, scale = 1): THREE.Texture {
  const f = weave(R, { seed, base: 0.55, scale });
  return paintTex('cloth' + seed + scale + R[2].join(), 64, 64, (x, y) => f(x, y, x * 0.5, y * 0.5), { repeat: true });
}
export function paperTex(seed = 5): THREE.Texture {
  const f = paperGrain(PAL.paper, { seed, base: 0.78 });
  return paintTex('paper' + seed, 64, 64, (x, y) => f(x, y, x * 0.7, y * 0.7), { repeat: true });
}
/** a gloss colour with a fine hand-painted mottle (enamel, lacquer, glaze) */
export function enamelTex(c: string, seed = 6): THREE.Texture {
  const base = hex(c);
  return paintTex('enamel' + c + seed, 32, 32, (x, y) => mul(base, 1 + (fbm(x * 0.18, y * 0.18, seed) - 0.5) * 0.16 + (hash(x, y, seed) - 0.5) * 0.04), { repeat: true });
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

type MatOpt = THREE.MeshStandardMaterialParameters & { physical?: THREE.MeshPhysicalMaterialParameters };
const matCache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}
function std(key: string, o: MatOpt): THREE.MeshStandardMaterial {
  return cached(key, () => {
    const { physical, ...rest } = o;
    return physical ? new THREE.MeshPhysicalMaterial({ ...rest, ...physical }) : new THREE.MeshStandardMaterial(rest);
  });
}
/** the shared materials (one instance each) */
export const MATS = {
  brass: () => std('brass', { map: brassTex(), metalness: 0.72, roughness: 0.32, envMapIntensity: 0.8 }),
  brassDark: () => std('brassDark', { map: brassTex(7, 0.42, 0.3), metalness: 0.8, roughness: 0.42, envMapIntensity: 1.0 }),
  gold: () => std('gold', { map: brassTex(9, 0.72, 0), metalness: 0.78, roughness: 0.26, envMapIntensity: 0.95, color: 0xfff0c8 }),
  steel: () => std('steel', { color: 0x2a2630, metalness: 0.6, roughness: 0.35, envMapIntensity: 0.9 }),
  blued: () => std('blued', { color: 0x1c2440, metalness: 0.7, roughness: 0.28, envMapIntensity: 1.1 }),
  red: () => std('redHand', { color: 0xd8282c, roughness: 0.35 }),
  walnut: () => std('walnut', { map: woodTex('walnut'), roughness: 0.72, envMapIntensity: 0.4 }),
  oak: () => std('oak', { map: woodTex('oak', 5), roughness: 0.55 }),
  leather: () => std('leather', { map: leatherTex(), roughness: 0.58, physical: { sheen: 0.4, sheenColor: new THREE.Color(0xd08070), sheenRoughness: 0.5 } }),
  paper: () => std('paper', { map: paperTex(), roughness: 0.92 }),
  ink: () => std('ink', { color: 0x1d1418, roughness: 0.5 }),
  /** dielectric gloss added on top of a surface: the reflections and glints of glass, nothing else */
  glassSpec: () => cached('glassSpec', () => new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, envMapIntensity: 4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })),
};

// ------------------------------------------------------------------ modelling helpers

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

/** a soft round contact shadow (a dark blob on the surface below) */
let blobTex: THREE.Texture | null = null;
export function contactBlob(w: number, d: number, opacity = 0.55): THREE.Mesh {
  blobTex ??= paintTex('blob', 32, 32, (x, y) => { const r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5); const a = clamp(1 - r) ** 1.6; return [255, 255, 255, a * 255]; }, { data: true, smooth: true });
  const m = new THREE.MeshBasicMaterial({ color: 0x1a0c08, alphaMap: blobTex, transparent: true, opacity, depthWrite: false });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
  me.rotation.x = -Math.PI / 2;
  me.renderOrder = 1;
  return me;
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

// ------------------------------------------------------------------ the moon lamp

export interface LampParts { root: THREE.Group; body: THREE.Group; moon: THREE.Group; sky: THREE.Mesh; chain: THREE.Group; setGlow: (g: number) => void; moonAt: THREE.Vector3; height: number }

function nightGlassTex(): THREE.Texture {
  const S = PAL.sapphire;
  return paintTex('nightglass', 256, 128, (x, y) => {
    const v = y / 127; // 0 top .. 1 bottom
    const neb = fbm(x * 0.03, y * 0.06, 11, 4);
    let c = rampAt(S, clamp(0.5 - v * 0.34 + (neb - 0.5) * 0.45));
    if (neb > 0.62) c = mix(c, hex('#6a5ab8'), (neb - 0.62) * 1.6);
    const h = hash(x, y, 3);
    if (h > 0.985) c = mix(c, [255, 246, 214], 0.9);
    else if (h > 0.972) c = mix(c, [190, 210, 255], 0.55);
    // a few bigger twinkles (little crosses)
    for (const [sx, sy] of [[30, 30], [96, 52], [170, 24], [212, 74], [60, 86], [140, 96], [236, 40]]) {
      const dx = Math.abs(x - sx), dy = Math.abs(y - sy);
      if ((dx === 0 && dy <= 2) || (dy === 0 && dx <= 2)) c = mix(c, [255, 248, 220], dx + dy === 0 ? 1 : 0.7);
    }
    return c;
  });
}
function moonTex(): THREE.Texture {
  const R = [hex('#9a5e1c'), hex('#c88a30'), hex('#e8b448'), hex('#f8d470'), hex('#fff0b0')];
  const craters: [number, number, number][] = [[20, 22, 5], [38, 40, 6], [16, 44, 3.5], [44, 18, 3], [30, 54, 4], [50, 34, 2.5]];
  return paintTex('moon', 64, 64, (x, y) => {
    let v = 0.62 + (fbm(x * 0.12, y * 0.12, 21) - 0.5) * 0.35;
    for (const [cx, cy, r] of craters) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) v -= 0.26 * (1 - d * 0.5); else if (d < 1.35) v += 0.12; }
    return rampAt(R, clamp(v));
  });
}
export function moonLamp(): LampParts {
  const B = MATS.brass();
  const foot = lathe(smoothProfile([[0, 0], [0.5, 0], [0.56, 0.015], [0.58, 0.05], [0.55, 0.085], [0.47, 0.1], [0.45, 0.13], [0.38, 0.16], [0.29, 0.22], [0.22, 0.3], [0.19, 0.37], [0.2, 0.41]], 3), B, 48);
  const knurl = at(torus(0.215, 0.035, B, Math.PI * 2, 8, 32), 0, 0.43, 0, Math.PI / 2);
  const neck = lathe(smoothProfile([[0.2, 0.45], [0.16, 0.5], [0.15, 0.56], [0.19, 0.6], [0.27, 0.63], [0.36, 0.66], [0.42, 0.7], [0.45, 0.74], [0.43, 0.76], [0.38, 0.75]], 3), B, 48);
  // a ring of little beads round the cup's rim
  const beads = grp();
  const beadGeo = new THREE.SphereGeometry(0.03, 8, 6);
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; const b = mesh(beadGeo, MATS.gold()); b.position.set(Math.cos(a) * 0.44, 0.765, Math.sin(a) * 0.44); beads.add(b); }
  // the turned base, a little squat so the whole lamp fits its shelf space
  const base = grp(foot, knurl, neck, beads);
  base.scale.y = 0.86;
  const R0 = 0.74, cy = 0.74 * 0.86 + R0 * 0.9;
  // the globe: a starry night painted on the inside of the glass (unlit, it glows), the moon's warm light inside it,
  // a faint tint, and the glass's own gloss
  const skyM = new THREE.MeshBasicMaterial({ map: nightGlassTex(), side: THREE.BackSide });
  const sky = at(mesh(new THREE.SphereGeometry(R0 * 0.985, 40, 28), skyM, false), 0, cy, 0);
  const haloT = paintTex('lamphalo', 32, 32, (x, y) => { const r = Math.hypot(x - 15.5, y - 15.5) / 15.5; return [255, 255, 255, clamp(1 - r) ** 1.8 * 255]; }, { data: true, smooth: true });
  const haloM = new THREE.MeshBasicMaterial({ color: 0xffc870, alphaMap: haloT, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = at(mesh(new THREE.PlaneGeometry(R0 * 1.5, R0 * 1.5), haloM, false), 0, cy, -0.3);
  halo.renderOrder = 2;
  const tint = at(mesh(new THREE.SphereGeometry(R0, 40, 28), new THREE.MeshStandardMaterial({ color: 0x5a7ad0, transparent: true, opacity: 0.1, roughness: 0.1, depthWrite: false }), false), 0, cy, 0);
  tint.renderOrder = 3;
  const gloss = at(mesh(new THREE.SphereGeometry(R0 * 1.004, 40, 28), MATS.glassSpec(), false), 0, cy, 0);
  gloss.renderOrder = 4;
  // the moon: a plump golden crescent with craters, and three little stars
  const moonM = new THREE.MeshStandardMaterial({ map: moonTex(), color: 0xffffff, emissive: 0xffb848, emissiveMap: moonTex(), emissiveIntensity: 0.4, roughness: 0.5 });
  const cres = planarUV(new THREE.ExtrudeGeometry(shape(crescentPts(0.42, 0.36, [0.2, 0.13])), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 32 }));
  cres.translate(0, 0, -0.06);
  cres.computeVertexNormals();
  const starM = new THREE.MeshStandardMaterial({ color: 0xffe49a, emissive: 0xffc850, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.3 });
  const star = (s: number) => ext(shape(starPts(s, s * 0.45)), s * 0.25, starM, s * 0.18, 2);
  const moon = grp(at(mesh(cres, moonM, false), -0.06, 0, 0, 0, 0, -0.25), at(star(0.075), 0.36, 0.3, 0.1, 0, 0.3, 0.2), at(star(0.05), 0.42, -0.14, 0.16, 0, -0.2, -0.3), at(star(0.042), -0.38, 0.44, -0.12, 0, 0.2, 0.5));
  moon.position.set(0, cy, 0.04);
  // the cap and finial
  const cap = lathe(smoothProfile([[0.0, cy + R0 + 0.1], [0.12, cy + R0 + 0.085], [0.2, cy + R0 + 0.03], [0.24, cy + R0 - 0.04], [0.2, cy + R0 - 0.05], [0.0, cy + R0 - 0.05]], 3), B, 40);
  const fin = lathe(smoothProfile([[0.0, cy + R0 + 0.22], [0.035, cy + R0 + 0.2], [0.05, cy + R0 + 0.16], [0.03, cy + R0 + 0.13], [0.06, cy + R0 + 0.11], [0.0, cy + R0 + 0.09]], 3), MATS.gold(), 24);
  const finRing = at(torus(0.05, 0.016, MATS.gold(), Math.PI * 2, 6, 20), 0, cy + R0 + 0.27, 0);
  // the pull chain: brass beads hanging from the cup, a teardrop pull
  const chain = grp();
  const chainBead = new THREE.SphereGeometry(0.022, 8, 6);
  for (let i = 0; i < 9; i++) { const b = mesh(chainBead, B); b.position.set(0, -i * 0.05, 0); chain.add(b); }
  chain.add(at(lathe(smoothProfile([[0, 0.02], [0.03, 0], [0.045, -0.05], [0.04, -0.09], [0.02, -0.12], [0, -0.125]], 3), MATS.gold(), 16), 0, -0.47, 0));
  chain.position.set(0.39, 0.62, 0.18);
  const body = grp(base, sky, halo, tint, gloss, moon, cap, fin, finRing, chain);
  const root = grp(body);
  const setGlow = (g: number) => {
    skyM.color.setScalar(0.62 + 0.38 * g);
    haloM.opacity = 0.06 + 0.14 * g;
    moonM.emissiveIntensity = 0.2 + 0.45 * g;
    starM.emissiveIntensity = 0.4 + 0.7 * g;
  };
  setGlow(0.8);
  return { root, body, moon, sky, chain, setGlow, moonAt: new THREE.Vector3(0, cy, 0.04), height: cy + R0 + 0.3 };
}

// ------------------------------------------------------------------ the twin-bell alarm clock

export interface ClockParts { root: THREE.Group; body: THREE.Group; hour: O; minute: O; second: O; alarm: O; hammer: O; bells: O[]; height: number; faceY: number }

function dialTex(): THREE.Texture {
  const E = PAL.enamel, N = 128, c = 63.5;
  const nums: [string, number][] = [['12', 0], ['3', 3], ['6', 6], ['9', 9]];
  const numAt = nums.map(([t, h]) => { const a = (h / 12) * Math.PI * 2; return digitsAt(t, c + Math.sin(a) * 41, c - Math.cos(a) * 41, 3); });
  return paintTex('dial', N, N, (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), a = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1;
    // warm cream enamel, a touch deeper towards the rim, with fine crazing
    let col = rampAt(E, clamp(0.78 - (r / 64) * 0.2 + (fbm(x * 0.15, y * 0.15, 8) - 0.5) * 0.12));
    if (Math.abs(fbm(x * 0.09, y * 0.09, 12) - 0.5) < 0.006) col = mul(col, 0.9);
    const ink = hex('#2a1c22'), red = hex('#b8282c');
    if (r > 60) return mix(col, hex('#c8b48a'), 0.6);
    // the minute track: two fine rings and sixty ticks
    if (Math.abs(r - 57) < 0.7 || Math.abs(r - 51) < 0.6) return ink;
    const m = a * 60, md = Math.abs(m - Math.round(m)) * (Math.PI * 2 * 54) / 60;
    if (r > 51 && r < 57 && md < 0.75) return Math.round(m) % 5 ? mix(ink, col, 0.25) : ink;
    // hour bars at the hours without numerals
    const hd = Math.abs(a * 12 - Math.round(a * 12)) * (Math.PI * 2 * 44) / 12;
    if (Math.round(a * 12) % 3 && r > 40 && r < 49 && hd < 1.6) return ink;
    for (const f of numAt) if (f(x, y)) return ink;
    // a small red crescent maker's mark
    if (Math.hypot(dx, dy - 20) < 6 && Math.hypot(dx + 2.5, dy - 18.5) > 5) return red;
    if (r < 3) return mix(col, ink, 0.3);
    return col;
  });
}
/** a clock hand shape pointing up +y from the arbor */
function handShape(kind: 'hour' | 'minute' | 'second' | 'alarm'): THREE.Shape {
  if (kind === 'hour') return shape([[-0.035, -0.08], [0.035, -0.08], [0.025, 0.18], [0.07, 0.24], [0.0, 0.34], [-0.07, 0.24], [-0.025, 0.18]]);
  if (kind === 'minute') return shape([[-0.028, -0.1], [0.028, -0.1], [0.018, 0.4], [0.045, 0.44], [0.0, 0.53], [-0.045, 0.44], [-0.018, 0.4]]);
  if (kind === 'alarm') return shape([[-0.018, -0.04], [0.018, -0.04], [0.014, 0.3], [0.05, 0.3], [0.0, 0.4], [-0.05, 0.3], [-0.014, 0.3]]);
  return shape([[-0.04, -0.17], [0.04, -0.17], [0.012, -0.1], [0.008, 0.56], [0.0, 0.6], [-0.008, 0.56], [-0.012, -0.1]]);
}
export function alarmClock(o: { caseColor?: number } = {}): ClockParts {
  const B = MATS.brass(), G = MATS.gold();
  const caseM = o.caseColor !== undefined ? std('case' + o.caseColor, { map: enamelTex('#' + o.caseColor.toString(16).padStart(6, '0'), 3), metalness: 0.15, roughness: 0.22, physical: { clearcoat: 0.8, clearcoatRoughness: 0.15 } }) : B;
  const faceY = 1.1, R = 0.74;
  // the drum case (turned about its axis, facing you), the front bezel, the dial, the domed glass
  const drum = lathe(smoothProfile([[0, -0.3], [0.42, -0.3], [0.62, -0.27], [0.74, -0.2], [0.8, -0.08], [0.81, 0.06], [0.79, 0.13], [0.74, 0.16], [0.7, 0.16]], 3), caseM, 56);
  drum.rotation.x = Math.PI / 2;
  const bezel = at(torus(0.695, 0.04, B, Math.PI * 2, 12, 64), 0, 0, 0.17);
  const bezel2 = at(torus(0.655, 0.016, G, Math.PI * 2, 8, 64), 0, 0, 0.2);
  const dial = at(mesh(planarUV(new THREE.CircleGeometry(0.665, 64)), std('dial', { map: dialTex(), roughness: 0.25, physical: { clearcoat: 0.6, clearcoatRoughness: 0.2 } }), false), 0, 0, 0.17);
  const glass = at(mesh(new THREE.SphereGeometry(1.6, 48, 12, 0, Math.PI * 2, 0, 0.42), MATS.glassSpec(), false), 0, 0, 0.28 - 1.6, Math.PI / 2);
  glass.renderOrder = 4;
  // the hands on their arbor, stacked front to back: second, minute, hour, alarm
  const handMesh = (k: 'hour' | 'minute' | 'second' | 'alarm', m: THREE.Material, z: number) => { const h = ext(handShape(k), 0.012, m, 0.006, 1, 8); h.castShadow = false; const p = grp(h); p.position.z = z; return p; };
  const alarm = handMesh('alarm', G, 0.185);
  const hour = handMesh('hour', MATS.blued(), 0.2);
  const minute = handMesh('minute', MATS.blued(), 0.215);
  const second = handMesh('second', MATS.red(), 0.23);
  const arbor = at(lathe([[0, 0.03], [0.035, 0.02], [0.04, 0], [0, 0]], G, 16), 0, 0, 0.235, Math.PI / 2);
  const face = grp(drum, bezel, bezel2, dial, glass, alarm, hour, minute, second, arbor);
  face.position.y = faceY;
  // the bells: domes on posts leaning out, each with a finial nut
  const bellProf = smoothProfile([[0.0, 0.3], [0.08, 0.29], [0.2, 0.24], [0.28, 0.15], [0.32, 0.05], [0.335, 0.0], [0.33, -0.02], [0.3, -0.005], [0.27, 0.06]], 3);
  const bells: O[] = [];
  for (const s of [-1, 1]) {
    const bell = grp(lathe(bellProf, B, 40), at(lathe(smoothProfile([[0, 0.4], [0.035, 0.39], [0.045, 0.35], [0.03, 0.31], [0, 0.3]], 2), G, 16), 0, 0, 0));
    const ang = s * 0.5;
    bell.position.set(s * 0.5, faceY + 0.86, -0.06);
    bell.rotation.z = -ang;
    bells.push(bell);
  }
  const posts = [-1, 1].map((s) => tube([[s * 0.22, faceY + 0.66, -0.06], [s * 0.36, faceY + 0.78, -0.06], [s * 0.44, faceY + 0.88, -0.06]], 0.022, B, 8, 6));
  // the hammer between the bells, on its spring arm
  const hammer = grp(tube([[0, 0, 0], [0, 0.16, 0.01], [0, 0.32, 0.0]], 0.016, B, 8, 6), at(ball(0.055, B, 12, 10), 0, 0.34, 0));
  hammer.position.set(0, faceY + 0.7, -0.02);
  // the carry handle behind the bells
  const handle = tube([[-0.3, faceY + 0.7, -0.2], [-0.24, faceY + 1.06, -0.22], [0, faceY + 1.16, -0.22], [0.24, faceY + 1.06, -0.22], [0.3, faceY + 0.7, -0.2]], 0.032, B, 24, 8);
  const handleCaps = [-1, 1].map((s) => at(ball(0.05, G, 10, 8), s * 0.3, faceY + 0.7, -0.2));
  // splayed feet with turned toes
  const legs = [-1, 1].map((s) => grp(
    tube([[s * 0.34, faceY - 0.56, -0.02], [s * 0.44, faceY - 0.78, 0.0], [s * 0.52, faceY - 1.02, 0.02]], 0.04, B, 10, 8),
    at(lathe(smoothProfile([[0, 0.1], [0.05, 0.09], [0.075, 0.05], [0.07, 0.015], [0.04, 0], [0, 0]], 2), G, 16), s * 0.53, 0, 0.02)));
  const body = grp(face, ...bells, ...posts, hammer, handle, ...handleCaps, ...legs);
  const root = grp(body);
  return { root, body, hour, minute, second, alarm, hammer, bells, height: faceY + 1.25, faceY };
}
/** set the hands: `d` the time (seconds may be fractional), `wakeMin` minutes past midnight of the alarm */
export function setClockHands(c: ClockParts, d: Date, wakeMin: number, secAngle?: number) {
  const h = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
  c.hour.rotation.z = -((h + m / 60) / 12) * Math.PI * 2;
  c.minute.rotation.z = -((m + s / 60) / 60) * Math.PI * 2;
  c.second.rotation.z = secAngle ?? -(s / 60) * Math.PI * 2;
  c.alarm.rotation.z = -(((wakeMin / 60) % 12) / 12) * Math.PI * 2;
}

// ------------------------------------------------------------------ the leather journal

export interface BookParts { root: THREE.Group; body: THREE.Group; cover: THREE.Group; tab: THREE.Group; ribbon: O; w: number; h: number; t: number }

function coverTex(): { map: THREE.Texture; bump: THREE.Texture } {
  const N = 128, Wd = 128, Hd = 128;
  const L = leatherGrain(PAL.leather, { seed: 13, base: 0.56 });
  const G = PAL.gold;
  // tooled double border, corner fleurons, a blind-tooled panel; worn paler towards the edges
  const tooled = (x: number, y: number): number => {
    const ex = Math.min(x, Wd - 1 - x), ey = Math.min(y, Hd - 1 - y), e = Math.min(ex, ey);
    if (e === 7 || e === 10) return 1; // the double fillet
    if (e > 10 && e < 14 && ((x + y) % 4 === 0)) return 0.6; // a little dotted roll inside it
    const cx = ex < 24 && ey < 24 ? Math.hypot(ex - 14, ey - 14) : 99;
    if (cx < 4.5 && cx > 2.5) return 1; // corner rosettes
    return 0;
  };
  const map = paintTex('cover-map', N, N, (x, y) => {
    let c = L(x, y, x * 0.9, y * 0.9);
    const ex = Math.min(x, Wd - 1 - x), ey = Math.min(y, Hd - 1 - y), e = Math.min(ex, ey);
    if (e < 4) c = mix(c, rampAt(PAL.leather, 0.8), (4 - e) * 0.08 + (hash(x, y, 2) > 0.7 ? 0.1 : 0));
    const t = tooled(x, y);
    if (t >= 1 && (e === 7)) return rampAt(G, 0.55 + (hash(x, y, 4) - 0.5) * 0.3); // gilt outer fillet
    if (t > 0) c = mul(c, 0.72);
    return c;
  });
  const bump = paintTex('cover-bump', N, N, (x, y) => grey(0.6 - tooled(x, y) * 0.35 + (vnoise(x * 1.1, y * 1.1, 3) - 0.5) * 0.12), { data: true });
  return { map, bump };
}
function pageEdgeTex(): THREE.Texture {
  return paintTex('pageedge', 16, 64, (x, y) => {
    const base = rampAt(PAL.paper, 0.78 + (vnoise(x * 0.2, y * 0.5, 4) - 0.5) * 0.1);
    return (y + Math.floor(vnoise(x * 0.15, 0, 7) * 2)) % 3 === 0 ? mul(base, 0.86) : base;
  }, { repeat: true });
}
function pageFaceTex(): THREE.Texture {
  const P = paperGrain(PAL.paper, { seed: 21, base: 0.82 }), ink = hex('#3a3060'), N = 64;
  return paintTex('pageface', N, N, (x, y) => {
    let c = P(x, y, x, y);
    if (y > 8 && y < 60 && y % 6 === 2) c = mix(c, hex('#9ab4d8'), 0.45); // ruled lines
    // handwriting: wobbly ink strokes on the lines
    const line = Math.floor((y - 3) / 6);
    if (line >= 2 && line < 9 && (y - 3) % 6 >= 3 && (y - 3) % 6 <= 4) {
      const len = 34 + (hash(line, 0, 5) * 20);
      if (x > 8 && x < len && vnoise(x * 0.6, line * 3, 9) > 0.42) c = mix(c, ink, 0.75);
    }
    // a little moon doodle
    if (Math.hypot(x - 50, y - 10) < 5 && Math.hypot(x - 52, y - 9) > 4) c = mix(c, hex('#d4a020'), 0.9);
    if (x < 2) c = mul(c, 0.85);
    return c;
  });
}
function endpaperTex(): THREE.Texture {
  return paintTex('endpaper', 64, 64, (x, y) => {
    const w = fbm(x * 0.05 + fbm(x * 0.04, y * 0.04, 3) * 2.5, y * 0.05, 7, 4);
    const R = [hex('#2a1d4a'), hex('#3c2c6c'), hex('#5a4a8e'), hex('#8a7ab8'), hex('#c8a85a')];
    const v = (Math.sin(w * 22) + 1) / 2;
    return v > 0.93 ? R[4] : rampAt(R.slice(0, 4), v);
  }, { repeat: true });
}
export function journal(): BookParts {
  const w = 1.56, h = 2.04, t = 0.5, ct = 0.075, r = 0.06;
  const { map, bump } = coverTex();
  const leatherM = std('cover', { map, bumpMap: bump, bumpScale: 1.2, roughness: 0.55, physical: { sheen: 0.35, sheenColor: new THREE.Color(0xe09080), sheenRoughness: 0.45 } });
  const plainLeather = MATS.leather();
  const boardGeo = () => { const g = new THREE.ExtrudeGeometry(shape(rrectPts(w, h, r)), { depth: ct - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 6 }); g.translate(0, 0, -(ct - 0.03) / 2); planarUV(g); g.computeVertexNormals(); return g; };
  // the back board, the spine (a rounded back with raised bands) and the page block
  const back = at(mesh(boardGeo(), plainLeather), w / 2, h / 2, -t / 2 + ct / 2);
  const spineR = t / 2;
  const spine = at(mesh(new THREE.CylinderGeometry(spineR, spineR, h - 0.01, 24, 1, true, Math.PI, Math.PI), plainLeather), 0.03, h / 2, 0);
  (spine.material as THREE.Material).side = THREE.DoubleSide;
  const bands = [0.28, 0.62, 1.42, 1.76].map((y) => at(torus(spineR + 0.008, 0.028, plainLeather, Math.PI, 6, 18), 0.03, y, 0, Math.PI / 2, 0, Math.PI / 2));
  const edge = pageEdgeTex();
  const pagesM = [std('pageEdgeV', { map: edge, roughness: 0.9 }), std('pageFace', { map: pageFaceTex(), roughness: 0.9 })];
  const blockGeo = new THREE.BoxGeometry(w - 0.1, h - 0.1, t - ct * 2 - 0.01);
  const pages = at(new THREE.Mesh(blockGeo, [pagesM[0], pagesM[0], pagesM[0], pagesM[0], pagesM[1], pagesM[0]]), 0.01 + (w - 0.1) / 2, h / 2, 0);
  pages.castShadow = true; pages.receiveShadow = true;
  // the front board on its hinge at the spine: tooled leather outside, a marbled endpaper inside, gilt corners,
  // a gold moon and stars
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
  const emblem = grp(
    at(ext(shape(crescentPts(0.3, 0.25, [0.13, 0.08])), 0.025, G, 0.012, 2), 0, 0, 0, 0, 0, -0.3),
    ...([[0.26, 0.28, 0.07], [0.34, -0.06, 0.05], [-0.28, 0.32, 0.045]] as [number, number, number][]).map(([x, y, s]) => at(ext(shape(starPts(s, s * 0.42)), 0.02, G, 0.008, 1), x, y, 0)));
  emblem.position.set(w / 2 + 0.06, h * 0.65, ct / 2 + 0.008);
  emblem.scale.setScalar(0.92);
  const coverIn = grp(front, endp, corner(1, 1), corner(1, -1), emblem);
  coverIn.position.set(0, 0, 0);
  const cover = grp(coverIn);
  cover.position.set(0, 0, t / 2 - ct / 2);
  // the strap: from the back board round the fore-edge onto the front, its tab held by a brass stud
  const strapM = std('strap', { map: leatherTex(PAL.cherry, 9), roughness: 0.55, side: THREE.DoubleSide });
  const sy = h * 0.36, sw = 0.22;
  const strapBack = ribbon([[w - 0.45, sy, -t / 2 - 0.012], [w - 0.05, sy, -t / 2 - 0.02], [w + 0.05, sy, -t / 2 + 0.04], [w + 0.08, sy, 0], [w + 0.05, sy, t / 2 - 0.02], [w - 0.02, sy, t / 2 + 0.03]], sw, strapM, { across: [0, 1, 0] });
  const tabShape = shape([[0, -sw / 2], [-0.42, -sw / 2], [-0.52, -sw / 2 + 0.03], [-0.55, 0], [-0.52, sw / 2 - 0.03], [-0.42, sw / 2], [0, sw / 2]]);
  const tabM = ext(tabShape, 0.024, strapM, 0.008, 1, 8);
  const stud = at(lathe(smoothProfile([[0, 0.035], [0.04, 0.03], [0.055, 0.012], [0.05, 0], [0, 0]], 2), G, 16), -0.4, 0, 0.012, Math.PI / 2);
  const tab = grp(tabM, stud, at(ball(0.012, G, 6, 4), -0.48, -0.06, 0.016), at(ball(0.012, G, 6, 4), -0.48, 0.06, 0.016));
  tab.position.set(w - 0.02, sy, t / 2 + 0.03);
  // the satin ribbon: out of the foot of the pages, across the shelf, its end cut in a swallowtail
  const ribM = std('ribbon', { color: 0x2f8a52, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide });
  const rib = ribbon([[w * 0.62, 0.06, 0.02], [w * 0.63, 0.012, 0.2], [w * 0.68, 0.008, 0.34], [w * 0.76, 0.01, 0.44], [w * 0.82, 0.008, 0.5]], 0.08, ribM, { lift: 0.004 });
  const tail = at(mesh(new THREE.ShapeGeometry(shape([[-0.04, 0], [0.04, 0], [0.04, 0.09], [0, 0.05], [-0.04, 0.09]])), ribM, false), w * 0.82, 0.009, 0.5, -Math.PI / 2, 0, -0.9);
  const ribbonG = grp(rib, tail);
  const body = grp(back, spine, ...bands, pages, cover, strapBack, tab, ribbonG);
  body.position.set(-w / 2 + 0.05, 0, 0);
  const root = grp(body);
  return { root, body, cover, tab, ribbon: ribbonG, w, h, t };
}

// ------------------------------------------------------------------ the carved shelf

export interface ShelfParts { root: THREE.Group; top: number; front: number; plates: THREE.Mesh[] }

/**
 * The shelf: `len` long (x), top surface at y = 0; returns the front face's z. `plates` are brass name plates
 * centred at the given x (width pw, height ph, centre height py on the front face).
 */
export function shelf(len: number, o: { plates?: { x: number; y: number; w: number; h: number }[]; bosses?: number[] } = {}): ShelfParts {
  const W = MATS.walnut();
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
      uv[i * 2] = a * 0.9; uv[i * 2 + 1] = (nx > 0.7 ? p.getY(i) : p.getX(i)) * 0.22;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const plank = mesh(g, W, false);
  const root = grp(plank);
  // carved rosettes between the plates: six rounded petals round a brass stud
  const petals: [number, number][] = Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * Math.PI * 2, r = 0.2 * (0.74 + 0.26 * Math.abs(Math.cos(a * 3))); return [Math.cos(a) * r, Math.sin(a) * r]; });
  for (const x of o.bosses ?? []) {
    const ros = ext(shape(petals), 0.03, MATS.brass(), 0.035, 3, 72);
    ros.castShadow = false;
    root.add(at(ros, x, -H * 0.5, front - 0.01, 0, 0, Math.PI / 6));
    root.add(at(lathe(smoothProfile([[0, 0.05], [0.04, 0.045], [0.06, 0.02], [0.058, 0], [0, 0]], 2), MATS.walnut(), 16), x, -H * 0.5, front + 0.03, Math.PI / 2));
  }
  // brass plates with domed screws
  const plates: THREE.Mesh[] = [];
  const B = std('plate', { map: brassTex(11, 0.66, 0.05), metalness: 0.78, roughness: 0.32, envMapIntensity: 1.1 });
  for (const pl of o.plates ?? []) {
    const pg = new THREE.ExtrudeGeometry(shape(rrectPts(pl.w, pl.h, Math.min(0.06, pl.h * 0.25))), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2, curveSegments: 4 });
    planarUV(pg);
    const p = mesh(pg, B, false);
    p.position.set(pl.x, pl.y, front - 0.03 + 0.01);
    plates.push(p);
    root.add(p);
    for (const s of [-1, 1]) root.add(at(lathe(smoothProfile([[0, 0.03], [0.03, 0.025], [0.042, 0.01], [0.04, 0], [0, 0]], 2), MATS.brassDark(), 12), pl.x + s * (pl.w / 2 - 0.09), pl.y, front + 0.02, Math.PI / 2));
  }
  return { root, top: 0, front, plates };
}

// ------------------------------------------------------------------ small details for the shelf top
export function acornProp(s = 1): THREE.Group {
  const nut = lathe(smoothProfile([[0, -0.3], [0.08, -0.28], [0.17, -0.18], [0.2, -0.05], [0.19, 0.04], [0.0, 0.06]], 3), std('acornNut', { map: woodTex('oak', 8), color: 0xffd0a0, roughness: 0.3, physical: { clearcoat: 0.6, clearcoatRoughness: 0.25 } }), 24);
  const capM = std('acornCap', { map: clothTex(PAL.walnut, 6, 0.6), roughness: 0.85 });
  const cap = lathe(smoothProfile([[0, 0.17], [0.1, 0.16], [0.19, 0.11], [0.235, 0.04], [0.22, 0.0], [0.18, 0.01], [0, 0.03]], 3), capM, 24);
  const stem = at(cyl(0.018, 0.026, 0.1, capM, 8), 0.01, 0.21, 0, 0, 0, -0.3);
  return at(grp(nut, cap, stem), 0, 0, 0, 0, 0, 0, s);
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
  const m = std('oakleaf', { map: paintTex('oakleaf', 16, 32, (x, y) => (Math.abs(x - 7.5) < 0.8 ? hex('#7a4a1c') : rampAt([hex('#8a4a14'), hex('#c06a1c'), hex('#e09a34'), hex('#f0c060')], 0.45 + (vnoise(x * 0.4, y * 0.3, 5) - 0.5) * 0.6))), roughness: 0.7, side: THREE.DoubleSide });
  const me = mesh(geo, m);
  me.scale.setScalar(s);
  return me;
}
