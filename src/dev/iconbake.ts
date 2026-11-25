// [icons6] The icon bake: every interface icon is a small, properly shaped 3D model (turned brass, carved wood, tooled
// leather, enamel, glass, cloth; no blocks and balls), lit like the live shelf (src/ui/chrome/shelf3d.tsx) and
// pixel-finished. The hero objects are the very models on the shelf (src/ui/chrome/props3d.ts: the alarm clock, the
// journal), furniture comes from the game's own GLBs, the rest are modelled here. Light: a studio panorama for
// reflections (a bright window up-left, a dark horizon band, a warm floor), a soft warm key from the top left, a sky
// fill and a cool rim; no cast shadows. Finish: rendered big, re-sampled to a few art pixels by the most common colour
// (crisp clusters, no blur), shaded in a few steps per colour with lights leaning gold and shadows leaning violet, a
// light painterly break-up, a little more colour, and a coloured outline that is softer on the lit side. Two sizes per
// icon (32 and 20 art px; packs bigger), and the currency (the acorn bag, the moon gem) glints in idle frames.
// [tex7] Every model is textured before it is baked: each material is a detailed hand-painted texture in full colour
// (src/ui/chrome/paint3d.ts: wood grain and knots, tooled leather, engraved and tarnished brass, crazed enamel, woven and
// knitted cloth, paper fibres, frosted glass, leaf veins, cut gems, wax, water, bark, stone), laid on at the icons' texel
// density (`fitUV`) and lit with the shared cel light (2-3 bands, cool shadows, a warm rim) like the shelf and the world.
// Extra sizes (12, 16, 24, 28 art px, `z`) let every icon be drawn at exactly one art pixel per artPx() CSS px; palettes
// are capped at 64 colours (median cut).
//
//   /dev-iconbake.html               bake everything and show it on paper (big, then at 1:1)
//   /dev-iconbake.html?only=regex     just some
//   window.__module                   the generated src/ui/px/icons3d.ts (a tools script writes it to disk)
import * as THREE from 'three';
import { instanceGLB } from '../gfx/glb.ts';
import { fbm, hash as h2, hex, type RGB } from '../ui/px/relief.ts';
import { bark, cel, cloth, cloudTex, density, enamel, fitUV, flame, gem, glass, keepUV, leafTex, leather, metal, paper, scales, stone, water, wax, wood, type Painted } from '../ui/chrome/paint3d.ts';
import {
  at, ball, circlePts, crescentPts, cuckooClock, cyl, ext, grp, journal, lathe, MATS, mesh, paintTex, planarUV, rrectPts, setClockHands, shape, smoothProfile, starPts, studioEnv, torus, tube,
  type O,
} from '../ui/chrome/props3d.ts';

const q = new URLSearchParams(location.search);
const SS = 8; // supersampling per art pixel

// ------------------------------------------------------------------ renderer and light
const canvas = document.createElement('canvas');
const R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
R.setClearColor(0x000000, 0);
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.ACESFilmicToneMapping;
R.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.environment = studioEnv(R);
scene.environmentIntensity = 0.95;
scene.add(new THREE.HemisphereLight(0xeef0ff, 0x5a4c8a, 0.72)); // [tex7] the cel light: a cool violet-blue shadow fill
const key = new THREE.DirectionalLight(0xffe4bc, 3.0); key.position.set(-3.5, 5, 3.5); scene.add(key);
const fill = new THREE.DirectionalLight(0xd8e4ff, 0.0); fill.position.set(4, 1, 3); scene.add(fill);
const rim = new THREE.DirectionalLight(0xe4ecff, 0.7); rim.position.set(2.5, 3, -5); scene.add(rim);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 500);

// ------------------------------------------------------------------ hand-painted textures for every material
/** the icons' texture density: a model about two units across fills a 32 art-pixel icon */
const ICON_DENS = density(15);
type TexKind = 'enamel' | 'grain' | 'weave' | 'burlap' | 'scale' | 'leather' | 'knit' | 'bark' | 'felt' | 'paper' | 'glass' | 'water' | 'wax' | 'stone' | 'cloud' | 'leaf' | 'foliage' | 'gem' | 'metal' | 'plain';
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
    case 'metal': return metal(c, { seed: 2 + seed % 7, patina: 0.2, engrave: 'rings', brush: 'u' });
    case 'plain': return enamel(c, { craze: 0, chips: false });
    default: return enamel(c, { craze: 0.8 });
  }
}

interface MOpt { metal?: number; rough?: number; tex?: TexKind | null; glow?: number; flat?: boolean; rep?: number; opacity?: number; side?: THREE.Side; env?: number }
const mats = new Map<string, THREE.Material>();
/** the bake's own materials (everything else, e.g. a painted face, keeps its own texture coordinates) */
const ownMats = new Set<THREE.Material>();
/**
 * A material: a hand-painted texture of `color` (enamel unless told otherwise; metal, glass, gem or a plain glaze when
 * `tex` is null), lit with the cel light.
 */
function M(color: number, o: MOpt = {}): THREE.MeshStandardMaterial {
  const k = color + JSON.stringify(o);
  let m = mats.get(k) as THREE.MeshStandardMaterial | undefined;
  if (m) return m;
  const c = '#' + color.toString(16).padStart(6, '0');
  const kind: TexKind = o.tex !== null && o.tex !== undefined ? o.tex : o.tex === null
    ? (o.flat ? 'gem' : (o.metal ?? 0) >= 0.4 ? 'metal' : o.opacity !== undefined || ((o.rough ?? 0.5) <= 0.1 && (o.env ?? 1) >= 1.3) ? 'glass' : 'plain')
    : 'enamel';
  const p = painted(kind, c, mats.size);
  m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: p.map, metalness: o.metal ?? 0, roughness: o.rough ?? 0.5, flatShading: !!o.flat, emissive: o.glow ? 0xffffff : 0x000000, emissiveMap: o.glow ? p.map : null, emissiveIntensity: o.glow ?? 0, side: o.side ?? THREE.FrontSide, envMapIntensity: o.env ?? 1 });
  if (p.bump) { m.bumpMap = p.bump; m.bumpScale = p.bumpScale ?? 1; }
  if (kind === 'leaf') keepUV(m);
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  cel(m);
  mats.set(k, m);
  ownMats.add(m);
  return m;
}
/** an unlit colour (flames, light) */
const unlit = (c: number) => { const k = 'unlit' + c; let m = mats.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ map: flame('#' + c.toString(16).padStart(6, '0')).map }); mats.set(k, m); ownMats.add(m); } return m; };
const C = {
  brass: () => M(0xf0b440, { metal: 0.55, rough: 0.3, tex: null, env: 1.2 }), gold: () => M(0xffcc3a, { metal: 0.5, rough: 0.28, tex: null, env: 1.2 }), silver: () => M(0xdfe6ee, { metal: 0.75, rough: 0.28, tex: null }),
  iron: () => M(0x9aa6b8, { metal: 0.7, rough: 0.38, tex: null }), wood: () => M(0xc47e40, { tex: 'grain', rough: 0.6 }), dark: () => M(0x7a4524, { tex: 'grain', rough: 0.65 }), oak: () => M(0xe6a85c, { tex: 'grain', rough: 0.6 }),
  red: () => M(0xe63e38, { rough: 0.28 }), green: () => M(0x38b85a, { rough: 0.28 }), blue: () => M(0x3a7ee6, { rough: 0.28 }), sky: () => M(0x5cc0f4, { rough: 0.26 }),
  rose: () => M(0xf2668a, { rough: 0.3 }), plum: () => M(0x9a5cd6, { rough: 0.32 }), cream: () => M(0xfff2d2, { rough: 0.45 }), paper: () => M(0xfaecd2, { rough: 0.85, tex: 'paper' }),
  leaf: () => M(0x58c044, { rough: 0.5, tex: 'leaf' }), leather: () => M(0xc04a30, { rough: 0.55, tex: 'leather' }), burlap: () => M(0xd6a560, { rough: 0.9, tex: 'burlap', rep: 2 }), white: () => M(0xffffff, { rough: 0.4 }),
  ink: () => M(0x30243a, { rough: 0.45, tex: null }), flame: () => unlit(0xff7a1c), flameIn: () => unlit(0xffd84a), glass: () => M(0xc4ecff, { rough: 0.06, metal: 0.1, tex: null, env: 1.6 }),
  kraft: () => M(0xd9a86a, { rough: 0.85, tex: 'paper' }), snow: () => M(0xf4f9ff, { rough: 0.45, tex: 'cloud' }), steel: () => M(0xb4bcc8, { metal: 0.8, rough: 0.3, tex: null }),
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
/** a pillowy extruded stroke */
const strokeMesh = (pts: P2[], w: number, m: THREE.Material, depth = 0.22, bev = 0.1) => ext(shape(strokePts(pts, w)), depth, m, bev, 4);
/** a round enamel button with a turned brass rim, facing the viewer */
function button(r: number, m: THREE.Material): O {
  return grp(ext(shape(circlePts(r, 64)), 0.22, m, 0.1, 4, 48), at(torus(r + 0.02, 0.07, C.brass(), Math.PI * 2, 10, 64), 0, 0, 0.0));
}
/** a glossy acorn: a golden nut, a scaly cap with a rim, a little stem */
function acorn(s = 1, tilt = 0): THREE.Group {
  const nut = lathe(smoothProfile([[0, -0.62], [0.14, -0.58], [0.32, -0.42], [0.41, -0.18], [0.42, 0.02], [0.38, 0.14], [0, 0.16]], 3), M(0xf2a02a, { rough: 0.22, tex: 'grain' }), 32);
  const cap = lathe(smoothProfile([[0, 0.44], [0.2, 0.4], [0.37, 0.29], [0.47, 0.14], [0.48, 0.05], [0.4, 0.03], [0, 0.05]], 3), M(0x6a3c1a, { rough: 0.85, tex: 'scale', rep: 2 }), 32);
  const stem = at(cyl(0.035, 0.05, 0.2, C.dark(), 8), 0.02, 0.52, 0, 0, 0, -0.3);
  return at(grp(nut, cap, stem), 0, 0, 0, 0, 0, tilt, s);
}
/** the acorn bag: a plump burlap sack tied at the neck with a red cord and bow, its ruffled top standing up, a golden
 * acorn stitched on the front, glossy acorns spilled at its foot */
function acornBag(o: { squash?: number; pouch?: 'burlap' | 'leather'; spill?: number } = {}): THREE.Group {
  const sq = o.squash ?? 0, leather = o.pouch === 'leather';
  const m = leather ? M(0xa8462a, { rough: 0.5, tex: 'leather' }) : M(0xd2a060, { rough: 0.9, tex: 'burlap', rep: 2 });
  const prof: [number, number][] = [[0, -0.8], [0.5, -0.78], [0.76, -0.6], [0.86, -0.3], [0.82, 0.0], [0.64, 0.24], [0.38, 0.4], [0.24, 0.46], [0.26, 0.54], [0.4, 0.68], [0.52, 0.84], [0.46, 0.9], [0.3, 0.8], [0.12, 0.7], [0, 0.68]];
  const body = lathe(prof, m, 48);
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
    const ruffle = y > 0.56 ? 1 + Math.sin(a * 7) * 0.16 : 1;
    const k = (1 + Math.sin(a * 3 + y * 2) * 0.05 + Math.sin(a * 5 - 1) * 0.03) * ruffle;
    pos.setXYZ(i, x * k * (1 + sq * 0.5), (y > 0.56 ? y + Math.sin(a * 7) * 0.04 : y) * (1 - sq), z * k * (1 + sq * 0.5));
  }
  body.geometry.computeVertexNormals();
  const RED = M(0xe8363c, { rough: 0.4, tex: 'weave' });
  const cord = at(torus(0.28, 0.08, RED, Math.PI * 2, 10, 32), 0, 0.46 * (1 - sq), 0, Math.PI / 2, 0, 0);
  const bow = grp(at(torus(0.15, 0.06, RED, Math.PI * 2, 8, 24), -0.16, 0, 0, 0, 0.3, 0), at(torus(0.15, 0.06, RED, Math.PI * 2, 8, 24), 0.16, 0, 0, 0, -0.3, 0), at(ball(0.08, RED), 0, 0, 0.02),
    strokeMesh([[-0.02, -0.02], [-0.16, -0.36]], 0.09, RED, 0.03, 0.02), strokeMesh([[0.02, -0.02], [0.18, -0.36]], 0.09, RED, 0.03, 0.02));
  at(bow, 0.04, 0.44 * (1 - sq), 0.3);
  const g = grp(body, cord, bow);
  const GOLD = M(0xffc83a, { rough: 0.45, tex: null }), CAPC = M(0x6a3a1a, { rough: 0.8, tex: null });
  const nutS = shape(Array.from({ length: 28 }, (_, i) => { const t = (i / 28) * Math.PI * 2, y = Math.cos(t); return [Math.sin(t) * 0.2 * (y < 0 ? 1 - (-y) * 0.35 : 1), y * 0.24 - 0.04] as P2; }));
  const capS = shape(Array.from({ length: 18 }, (_, i) => { const t = (i / 17) * Math.PI; return [Math.cos(t) * 0.24, Math.sin(t) * 0.13] as P2; }));
  g.add(at(grp(at(ext(nutS, 0.02, GOLD, 0.012), 0, -0.08, 0), at(ext(capS, 0.02, CAPC, 0.012), 0, 0.1, 0.01)), 0.03, -0.22 * (1 - sq), 0.84, -0.12, 0.08, 0));
  const spill = o.spill ?? 2;
  if (spill > 0) g.add(at(acorn(0.6, 0.6), 0.7, -0.56, 0.52));
  if (spill > 1) g.add(at(acorn(0.5, -0.55), -0.64, -0.64, 0.5));
  return g;
}
/** a brilliant-cut moon gem: a crown and pavilion of flat facets with a golden crescent set in its table */
function moonGem(): O {
  const gm = M(0x9466e6, { rough: 0.08, metal: 0.2, flat: true, tex: null, env: 1.4 });
  const gem = lathe([[0, -0.9], [0.66, -0.06], [0.72, 0.04], [0.56, 0.36], [0.3, 0.46], [0, 0.46]], gm, 10);
  gem.rotation.y = Math.PI / 10;
  const moon = at(ext(shape(crescentPts(0.2, 0.17, [0.08, 0.05], 48)), 0.04, M(0xffd86a, { glow: 0.4, rough: 0.3, tex: null }), 0.02, 2), 0, 0.05, 0.58);
  return grp(gem, moon);
}
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

// ------------------------------------------------------------------ the icon models
type Make = () => O | Promise<O>;
interface Spec { make: Make; yaw?: number; pitch?: number; pad?: number; vivid?: number }
const glb = (path: string, fix?: (o: O) => void): Make => async () => { const { root } = await instanceGLB(path); fix?.(root); root.userData.glb = true; return root; };
/**
 * Ready a model for the bake: the cel light on every lit material, and the bake's own painted materials laid on at
 * the icons' texel density (a painted face, a borrowed model's own textures keep their coordinates).
 */
function prep(obj: O): O {
  obj.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    for (const m of Array.isArray(me.material) ? me.material : [me.material]) {
      if (!ownMats.has(m) && !(m as THREE.Material).userData.shelfMat) keepUV(m);
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) cel(m);
    }
  });
  if (!obj.userData.glb) fitUV(obj, ICON_DENS);
  return obj;
}
const T = 0.3; // token depth

const CHECK: P2[] = [[-0.72, 0.02], [-0.24, -0.46], [0.74, 0.6]];
const ICONS: Record<string, Spec> = {
  check: { make: () => strokeMesh(CHECK, 0.36, C.green(), T, 0.12), yaw: 0.3, pitch: 0.28 },
  cross: { make: () => grp(strokeMesh([[-0.6, -0.6], [0.6, 0.6]], 0.34, C.red(), T, 0.12), at(strokeMesh([[-0.6, 0.6], [0.6, -0.6]], 0.34, C.red(), T, 0.12), 0, 0, 0.01)), yaw: 0.3, pitch: 0.28 },
  plus: { make: () => grp(button(0.88, C.green()), at(grp(strokeMesh([[-0.44, 0], [0.44, 0]], 0.24, C.cream(), 0.1, 0.05), strokeMesh([[0, -0.44], [0, 0.44]], 0.24, C.cream(), 0.1, 0.05)), 0, 0, 0.22)), yaw: 0.28, pitch: 0.24 },
  minus: { make: () => grp(button(0.88, C.rose()), at(strokeMesh([[-0.44, 0], [0.44, 0]], 0.24, C.cream(), 0.1, 0.05), 0, 0, 0.22)), yaw: 0.28, pitch: 0.24 },
  info: { make: () => grp(button(0.88, C.blue()), at(grp(at(ext(shape(circlePts(0.12, 24)), 0.08, C.cream(), 0.05, 2), 0, 0.42, 0), strokeMesh([[-0.1, 0.12], [0.02, 0.12], [0.02, -0.46]], 0.2, C.cream(), 0.08, 0.05)), 0, 0, 0.22)), yaw: 0.28, pitch: 0.24 },
  arrow_right: { make: () => ext(shape([[-0.8, -0.22], [0.1, -0.22], [0.1, -0.6], [0.85, 0], [0.1, 0.6], [0.1, 0.22], [-0.8, 0.22]]), T, C.green(), 0.1, 3), yaw: 0.3, pitch: 0.28 },
  arrow_left: { make: () => ext(shape([[0.8, -0.22], [-0.1, -0.22], [-0.1, -0.6], [-0.85, 0], [-0.1, 0.6], [-0.1, 0.22], [0.8, 0.22]]), T, C.green(), 0.1, 3), yaw: 0.3, pitch: 0.28 },
  arrow_up: { make: () => ext(shape([[-0.22, -0.8], [0.22, -0.8], [0.22, 0.1], [0.6, 0.1], [0, 0.85], [-0.6, 0.1], [-0.22, 0.1]]), T, C.green(), 0.1, 3), yaw: 0.3, pitch: 0.28 },
  arrow_down: { make: () => ext(shape([[-0.22, 0.8], [0.22, 0.8], [0.22, -0.1], [0.6, -0.1], [0, -0.85], [-0.6, -0.1], [-0.22, -0.1]]), T, C.rose(), 0.1, 3), yaw: 0.3, pitch: 0.28 },
  rotate_right: { make: () => grp(at(torus(0.56, 0.15, C.sky(), Math.PI * 1.45, 12, 48), 0, 0, 0, 0, 0, Math.PI * 0.55), at(ext(shape([[-0.34, 0], [0.34, 0], [0, 0.4]]), 0.2, C.sky(), 0.07, 3), 0.56, -0.04, 0, 0, 0, Math.PI)), yaw: 0.28, pitch: 0.28 },
  rotate_left: { make: () => grp(at(torus(0.56, 0.15, C.sky(), Math.PI * 1.45, 12, 48), 0, 0, 0, 0, Math.PI, Math.PI * 0.55), at(ext(shape([[-0.34, 0], [0.34, 0], [0, 0.4]]), 0.2, C.sky(), 0.07, 3), -0.56, -0.04, 0, 0, 0, Math.PI)), yaw: 0.28, pitch: 0.28 },
  play: { make: () => ext(shape([[-0.42, -0.62], [0.68, 0], [-0.42, 0.62]]), T, C.green(), 0.16, 4), yaw: 0.32, pitch: 0.24 },
  pause: { make: () => grp(at(strokeMesh([[0, -0.52], [0, 0.52]], 0.34, C.blue(), T, 0.12), -0.3, 0, 0), at(strokeMesh([[0, -0.52], [0, 0.52]], 0.34, C.blue(), T, 0.12), 0.3, 0, 0)), yaw: 0.32, pitch: 0.24 },
  lock: {
    make: () => {
      const keyhole = shape([...Array.from({ length: 24 }, (_, i) => { const a = -Math.PI / 3 + (i / 23) * ((Math.PI * 5) / 3); return [Math.cos(a) * 0.1, 0.06 + Math.sin(a) * 0.1] as P2; }), [-0.06, -0.22], [0.06, -0.22]]);
      return grp(at(ext(shape(rrectPts(1.1, 0.86, 0.16)), 0.36, C.brass(), 0.08, 3), 0, -0.3, 0),
        at(torus(0.31, 0.085, C.steel(), Math.PI, 12, 32), 0, 0.2, 0), at(cyl(0.085, 0.085, 0.3, C.steel(), 12), -0.31, 0.06, 0), at(cyl(0.085, 0.085, 0.3, C.steel(), 12), 0.31, 0.06, 0),
        at(ext(keyhole, 0.03, C.ink(), 0.01, 1), 0, -0.32, 0.27));
    }, yaw: 0.42, pitch: 0.28,
  },
  star: { make: () => ext(shape(starPts(0.95, 0.44)), 0.26, C.gold(), 0.16, 4), yaw: 0.32, pitch: 0.28 },
  heart: { make: () => ext(shape(Array.from({ length: 72 }, (_, i) => { const t = (i / 72) * Math.PI * 2; return [(16 * Math.sin(t) ** 3) / 16 * 0.95, ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16) * 0.95 + 0.1] as P2; })), 0.32, C.rose(), 0.18, 5), yaw: 0.32, pitch: 0.28 },
  sparkle: { make: () => grp(ext(shape(starPts(0.95, 0.22, 4)), 0.2, C.gold(), 0.1, 3), at(ext(shape(starPts(0.36, 0.1, 4)), 0.12, M(0xfff4c0, { glow: 0.3, rough: 0.3 }), 0.06, 2), 0.62, 0.6, 0.1)), yaw: 0.28, pitch: 0.28 },
  moon: { make: () => ext(shape(crescentPts(0.85, 0.72, [0.38, 0.22])), 0.28, M(0xffd462, { rough: 0.35, glow: 0.12 }), 0.14, 4), yaw: 0.32, pitch: 0.28 },
  sun: { make: () => { const g = grp(at(ext(shape(circlePts(0.5, 48)), 0.26, C.gold(), 0.12, 4), 0, 0, 0.06)); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(at(ext(shape([[-0.13, 0], [0.13, 0], [0, 0.3]]), 0.12, M(0xffa83a, { rough: 0.3 }), 0.05, 2), Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0, 0, 0, a - Math.PI / 2)); } return g; }, yaw: 0.28, pitch: 0.28 },
  shield: {
    make: () => { const pts: P2[] = [[-0.72, 0.78], [0.72, 0.78], [0.72, 0.08], [0.5, -0.42], [0, -0.88], [-0.5, -0.42], [-0.72, 0.08]];
      return grp(ext(shape(pts), 0.22, C.blue(), 0.12, 3), at(ext(shape(pts.map(([x, y]) => [x * 1.06, y * 1.05 + 0.01] as P2)), 0.12, C.brass(), 0.06, 2), 0, 0, -0.08), at(ext(shape(starPts(0.36, 0.16)), 0.1, C.gold(), 0.06, 2), 0, 0.06, 0.2)); }, yaw: 0.32, pitch: 0.28,
  },
  zzz: { make: () => { const Z = (s: number) => strokePts([[-0.45 * s, 0.4 * s], [0.42 * s, 0.4 * s], [-0.42 * s, -0.4 * s], [0.45 * s, -0.4 * s]], 0.2 * s, 6); return grp(at(ext(shape(Z(0.95)), 0.2, C.sky(), 0.06, 2), -0.44, -0.38, 0), at(ext(shape(Z(0.68)), 0.18, C.sky(), 0.05, 2), 0.16, 0.2, 0), at(ext(shape(Z(0.46)), 0.16, C.sky(), 0.05, 2), 0.62, 0.66, 0)); }, yaw: 0.28, pitch: 0.2 },
  bolt: { make: () => ext(shape([[0.15, 0.95], [-0.55, -0.1], [-0.05, -0.1], [-0.25, -0.95], [0.55, 0.15], [0.05, 0.15]]), 0.26, M(0xffd23a, { rough: 0.3, glow: 0.15 }), 0.1, 3), yaw: 0.32, pitch: 0.28 },
  ice_flake: {
    make: () => { const ice = M(0x4ab8f4, { rough: 0.15, metal: 0.15, env: 1.3, tex: 'glass' }), g = grp(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); g.add(strokeMesh([[0, 0], [c * 0.88, s * 0.88]], 0.12, ice, 0.1, 0.04)); for (const f of [0.45, 0.7]) { const px = c * f, py = s * f; for (const sg of [-1, 1]) g.add(strokeMesh([[px, py], [px + Math.cos(a + sg * 0.8) * 0.22, py + Math.sin(a + sg * 0.8) * 0.22]], 0.1, ice, 0.1, 0.04)); } } return g; }, yaw: 0.28, pitch: 0.28,
  },
  alarm: { make: () => { const c = cuckooClock(); setClockHands(c, new Date(2024, 0, 1, 7, 0, 0)); c.door.rotation.y = -2.1; c.owl.position.set(0, c.owl.position.y - 0.05, 0.5); c.owl.rotation.x = 0.2; c.owl.scale.setScalar(2.4); return c.root; }, yaw: 0.26, pitch: 0.12 },
  clock: { make: () => { const c = cuckooClock(); setClockHands(c, new Date(2024, 0, 1, 10, 10, 0)); c.pendulum.rotation.z = 0.2; return c.root; }, yaw: 0.22, pitch: 0.1 },
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
  music: {
    make: () => { const b = C.blue(); const head = (x: number, y: number) => at(ext(shape(circlePts(0.24, 32).map(([px, py]) => [px * 1.25, py * 0.9] as P2)), 0.12, b, 0.07, 3), x, y, 0, 0, 0, 0.35);
      return grp(head(-0.44, -0.56), head(0.44, -0.4), strokeMesh([[-0.18, -0.5], [-0.18, 0.56]], 0.1, b, 0.1, 0.03), strokeMesh([[0.7, -0.34], [0.7, 0.74]], 0.1, b, 0.1, 0.03), strokeMesh([[-0.18, 0.5], [0.7, 0.68]], 0.24, b, 0.12, 0.04)); }, yaw: 0.28, pitch: 0.2,
  },
  note: {
    make: () => { const b = C.blue(); return grp(at(ext(shape(circlePts(0.3, 32).map(([px, py]) => [px * 1.25, py * 0.9] as P2)), 0.14, b, 0.08, 3), -0.18, -0.55, 0, 0, 0, 0.35), strokeMesh([[0.14, -0.5], [0.14, 0.8]], 0.12, b, 0.12, 0.03),
      ext(shape([[0.1, 0.8], [0.22, 0.8], [0.5, 0.52], [0.56, 0.26], [0.48, 0.06], [0.5, 0.3], [0.38, 0.46], [0.18, 0.56]]), 0.1, b, 0.04, 2)); }, yaw: 0.28, pitch: 0.2,
  },
  mic: {
    make: () => { const grille = M(0x9aa4b4, { metal: 0.6, rough: 0.35, tex: 'weave', rep: 3 });
      return grp(at(lathe(smoothProfile([[0, 0.62], [0.2, 0.58], [0.3, 0.46], [0.32, 0.25], [0.31, 0.05], [0, 0.04]], 3), grille, 32), 0, 0.02, 0), at(torus(0.315, 0.035, C.brass(), Math.PI * 2, 8, 32), 0, 0.3, 0, Math.PI / 2), at(lathe(smoothProfile([[0, 0.08], [0.32, 0.06], [0.33, 0], [0.2, -0.1], [0, -0.12]], 2), C.brass(), 24), 0, 0.04, 0),
        at(torus(0.44, 0.045, C.brass(), Math.PI, 8, 24), 0, 0.22, 0, 0, 0, Math.PI), at(cyl(0.045, 0.045, 0.5, C.brass(), 8), 0, -0.46, 0), at(lathe(smoothProfile([[0, 0.1], [0.3, 0.08], [0.42, 0.02], [0.4, -0.04], [0, -0.04]], 2), C.dark(), 32), 0, -0.76, 0)); }, yaw: 0.4, pitch: 0.24,
  },
  speaker_on: { make: () => grp(speaker(), at(torus(0.42, 0.07, C.sky(), 1.4, 8, 24), 0.16, 0, 0, 0, 0, -0.7), at(torus(0.7, 0.07, C.sky(), 1.3, 8, 24), 0.16, 0, 0, 0, 0, -0.65)), yaw: 0.25, pitch: 0.15 },
  speaker_off: { make: () => grp(speaker(), strokeMesh([[0.34, -0.3], [0.88, 0.3]], 0.16, C.red(), 0.16, 0.05), strokeMesh([[0.34, 0.3], [0.88, -0.3]], 0.16, C.red(), 0.16, 0.05)), yaw: 0.25, pitch: 0.15 },
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
    make: () => grp(lathe(smoothProfile([[0, -0.8], [0.5, -0.78], [0.58, -0.6], [0.58, 0.38], [0.46, 0.54], [0.38, 0.6], [0, 0.6]], 3), M(0x9ad8f0, { rough: 0.06, metal: 0.15, tex: null, env: 1.6, opacity: 0.5 }), 40), at(lathe(smoothProfile([[0, 0.12], [0.4, 0.12], [0.43, 0.06], [0.42, 0], [0, 0]], 2), C.brass(), 32), 0, 0.62, 0),
      ...[[-0.2, -0.2], [0.18, 0.1], [0.05, -0.5], [-0.12, 0.28]].map(([x, y]) => at(ball(0.1, M(0xfff27a, { glow: 1.2, tex: null }), 10, 8), x, y, 0.4))), yaw: 0.4, pitch: 0.2,
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
      return grp(ext(shape(rrectPts(1.2, 1.56, 0.1)), 0.06, C.wood(), 0.03, 2), at(mesh(planarUV(new THREE.PlaneGeometry(1.0, 1.24)), new THREE.MeshStandardMaterial({ map: ruled, roughness: 0.85 })), 0, -0.08, 0.06),
        at(ext(shape([[-0.3, -0.1], [0.3, -0.1], [0.26, 0.12], [0.12, 0.16], [0.08, 0.26], [-0.08, 0.26], [-0.12, 0.16], [-0.26, 0.12]]), 0.08, C.silver(), 0.03, 2), 0, 0.66, 0.08)); }, yaw: 0.3, pitch: 0.2,
  },
  satchel: {
    make: () => { const lea = C.leather(), dk = M(0x8a3420, { rough: 0.55, tex: 'leather' });
      return grp(at(ext(shape(rrectPts(1.36, 1.0, 0.22)), 0.36, lea, 0.12, 3), 0, -0.24, 0), at(ext(shape([[-0.7, 0.26], [0.7, 0.26], [0.7, -0.14], [0.5, -0.32], [-0.5, -0.32], [-0.7, -0.14]]), 0.06, dk, 0.04, 2), 0, 0.02, 0.24),
        ...[-0.32, 0.32].map((x) => grp(at(ext(shape(rrectPts(0.12, 0.5, 0.04)), 0.02, dk, 0.01, 1), x, -0.2, 0.3), at(ext(shape(rrectPts(0.18, 0.14, 0.03)), 0.03, C.brass(), 0.015, 1), x, -0.32, 0.32))),
        tube([[-0.6, 0.2, 0], [-0.52, 0.72, 0], [0, 0.94, 0], [0.52, 0.72, 0], [0.6, 0.2, 0]], 0.06, dk, 24, 8)); }, yaw: 0.34, pitch: 0.22,
  },
  map: { make: () => { const g = grp(); const tx = mapTex(); for (let i = 0; i < 3; i++) { const p = mesh(new THREE.PlaneGeometry(0.62, 1.4), new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.8 })); const uv = p.geometry.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3); g.add(at(p, -0.6 + i * 0.6, 0, i % 2 ? -0.12 : 0, 0, i % 2 ? 0.35 : -0.35, 0)); } return g; }, yaw: 0.2, pitch: 0.25 },
  gear: { make: () => gear(M(0xeaa634, { metal: 0.55, rough: 0.3, tex: null })), yaw: 0.32, pitch: 0.28 },
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
  nights: { make: () => grp(at(ext(shape(crescentPts(0.65, 0.55, [0.3, 0.18])), 0.22, M(0xffd462, { rough: 0.35 }), 0.1, 3), -0.2, 0, 0), at(ext(shape(starPts(0.28, 0.12)), 0.12, C.gold(), 0.05, 2), 0.62, 0.55, 0), at(ext(shape(starPts(0.2, 0.09)), 0.1, C.gold(), 0.05, 2), 0.72, -0.35, 0)), yaw: 0.28, pitch: 0.28 },
  things: {
    make: () => { const wood = M(0xc8783a, { tex: 'grain', rough: 0.55 }), band = M(0x6a5a5a, { metal: 0.6, rough: 0.4, tex: null });
      const lidG = new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24, 1, false, 0, Math.PI); lidG.rotateZ(Math.PI / 2);
      return grp(at(ext(shape(rrectPts(1.3, 0.62, 0.05)), 0.84, wood, 0.03, 2), 0, -0.3, 0), at(mesh(lidG, wood), 0, 0.02, 0, 0, 0, 0, [1, 0.8, 1]),
        ...[-0.42, 0.42].map((x) => grp(at(ext(shape(rrectPts(0.1, 0.62, 0.02)), 0.88, band, 0.015, 1), x, -0.3, 0), at(torus(0.425, 0.05, band, Math.PI, 6, 20), x, 0.02, 0, 0, Math.PI / 2, 0, [1, 0.8, 1]))),
        at(ext(shape(rrectPts(0.22, 0.28, 0.05)), 0.04, C.gold(), 0.02, 2), 0, -0.04, 0.45), at(ext(shape(circlePts(0.04, 12)), 0.02, C.ink(), 0.01, 1), 0, -0.06, 0.49),
        at(moonGem(), 0.32, 0.4, 0.06, 0.3, 0.4, -0.3, 0.3), at(acorn(0.3, 0.6), -0.3, 0.42, 0.1)); }, yaw: 0.55, pitch: 0.32,
  },
  seals: { make: () => { const pts: P2[] = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, r = 0.62 + Math.sin(a * 9) * 0.05 + (h2(i, 1, 2) - 0.5) * 0.03; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.2]); }
    const rib = M(0xd8343c, { rough: 0.35, tex: 'weave' });
    return grp(at(ext(shape([[-0.15, -0.2], [0.05, -0.2], [-0.25, -1], [-0.36, -0.84], [-0.46, -0.98]]), 0.04, rib, 0.02, 1), 0, 0, -0.1), at(ext(shape([[0.15, -0.2], [-0.05, -0.2], [0.25, -1], [0.36, -0.84], [0.46, -0.98]]), 0.04, rib, 0.02, 1), 0, 0, -0.1),
      ext(shape(pts), 0.16, M(0xc8303a, { rough: 0.3 }), 0.1, 3), at(ext(shape(circlePts(0.4, 40)), 0.04, M(0xa8202c, { rough: 0.35 }), 0.04, 2), 0, 0.2, 0.12), at(ext(shape(starPts(0.24, 0.11)), 0.04, M(0xe85058, { rough: 0.3 }), 0.02, 2), 0, 0.2, 0.17)); }, yaw: 0.28, pitch: 0.28 },
  wd_feather: { make: () => { const vane: P2[] = []; for (let i = 0; i <= 50; i++) { const t = (i / 50) * Math.PI * 2, y = Math.cos(t); const notch = Math.sin(t * 13) > 0.85 ? 0.88 : 1; vane.push([Math.sin(t) * 0.3 * (1 + 0.2 * y) * notch, y * 0.86 + 0.12]); }
    return at(grp(ext(shape(vane), 0.04, M(0xd8905a, { tex: 'grain', rough: 0.6 }), 0.03, 2), at(cyl(0.025, 0.035, 1.95, C.cream(), 8), 0, -0.03, 0.04)), 0, 0, 0, 0, 0, -0.6); }, yaw: 0.28, pitch: 0.28 },
  tophat: { make: () => grp(lathe(smoothProfile([[0, -0.5], [0.95, -0.5], [0.98, -0.44], [0.62, -0.4], [0.56, -0.3], [0.55, 0.5], [0.6, 0.6], [0, 0.62]], 2), M(0x3a2a52, { rough: 0.45, tex: 'felt' }), 48), at(cyl(0.565, 0.57, 0.2, C.red(), 40), 0, -0.26, 0), at(ext(shape(rrectPts(0.2, 0.16, 0.04)), 0.04, C.gold(), 0.02, 1), 0.2, -0.26, 0.55, 0, 0.35, 0)), yaw: 0.4, pitch: 0.32 },
  wd_glasses: { make: () => grp(...[-0.48, 0.48].map((x) => at(torus(0.36, 0.075, C.gold(), Math.PI * 2, 10, 40), x, 0, 0)), ...[-0.48, 0.48].map((x) => at(cyl(0.33, 0.33, 0.03, M(0x8fd8ff, { rough: 0.06, metal: 0.2, tex: null, env: 2 }), 32), x, 0, -0.01, Math.PI / 2)), at(torus(0.14, 0.055, C.gold(), Math.PI, 8, 16), 0, 0.08, 0), ...[-1, 1].map((sx) => tube([[sx * 0.84, 0.1, -0.02], [sx * 0.92, 0.12, -0.3], [sx * 0.9, 0.0, -0.5]], 0.04, C.gold(), 12, 6))), yaw: 0.3, pitch: 0.2 },
  wd_scarf: { make: () => { const st = new THREE.MeshStandardMaterial({ map: stripeTex(['#e0363c', '#fff0cc'], [3, 1]), roughness: 0.75 }); return grp(tube([[-0.5, 0.55, 0], [0, 0.72, 0.2], [0.5, 0.55, 0], [0.55, 0.3, 0.1], [0.2, 0.15, 0.25], [-0.25, 0.2, 0.2], [-0.4, -0.3, 0.25], [-0.3, -0.85, 0.2]], 0.2, st, 64, 12), at(ext(shape(rrectPts(0.36, 0.5, 0.06)), 0.1, st, 0.04, 2), 0.35, -0.45, 0.25, 0, 0, -0.25)); }, yaw: 0.3, pitch: 0.25 },
  wd_sweater: { make: () => sweater(), yaw: 0.3, pitch: 0.15 },
  wd_cape: { make: () => grp(ext(shape([[-0.32, 0.7], [0.32, 0.7], [0.82, -0.72], [0.5, -0.86], [0, -0.78], [-0.5, -0.86], [-0.82, -0.72]]), 0.14, M(0x7a4ad6, { rough: 0.5, tex: 'weave' }), 0.08, 3), at(torus(0.32, 0.1, M(0xb07ae8, { rough: 0.5, tex: 'weave' }), Math.PI * 2, 10, 32), 0, 0.68, 0.02, Math.PI / 2 - 0.3, 0, 0, [1, 1, 0.6]), at(ext(shape(crescentPts(0.16, 0.14, [0.07, 0.04], 48)), 0.05, C.gold(), 0.02, 2), 0, 0.58, 0.16), ...[[-0.3, -0.2], [0.35, -0.45], [0.1, 0.1]].map(([x, y]) => at(ext(shape(starPts(0.08, 0.035)), 0.02, C.gold(), 0.01, 1), x, y, 0.12))), yaw: 0.3, pitch: 0.2 },
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
  bp_chair: { make: glb('items/armchair.glb'), yaw: 0.6, pitch: 0.28, vivid: 1.25 },
  bp_table: { make: glb('items/round_table.glb'), yaw: 0.6, pitch: 0.34, vivid: 1.2 },
  bp_shelf: { make: glb('items/bookshelf.glb'), yaw: 0.45, pitch: 0.2, vivid: 1.25 },
  bp_lamp: {
    make: () => grp(at(lathe(smoothProfile([[0.3, 0], [0.5, -0.32], [0.64, -0.56], [0.6, -0.58], [0.28, -0.04]], 3), M(0xffc46a, { rough: 0.8, glow: 0.35, tex: 'weave', side: THREE.DoubleSide }), 40), 0, 0.74, 0),
      at(lathe(smoothProfile([[0.04, -0.6], [0.05, 0], [0.04, 0.5]], 2), C.brass(), 10), 0, -0.1, 0), at(lathe(smoothProfile([[0, -0.86], [0.5, -0.84], [0.53, -0.78], [0.3, -0.72], [0.14, -0.6], [0.06, -0.58], [0, -0.58]], 3), C.brass(), 40), 0, 0, 0),
      at(lathe(smoothProfile([[0, -0.1], [0.1, -0.04], [0.1, 0.06], [0, 0.14]], 2), M(0xfff4c0, { glow: 1.2, tex: null }), 12), 0, 0.3, 0)), yaw: 0.4, pitch: 0.24,
  },
  bp_plant: { make: glb('items/fernpot.glb'), yaw: 0.5, pitch: 0.3, vivid: 1.25 },
  bp_rug: { make: () => at(mesh(new THREE.CylinderGeometry(1, 1, 0.08, 64), new THREE.MeshStandardMaterial({ map: ringTex(), roughness: 0.9 })), 0, 0, 0, 0, 0, 0, [1, 1, 0.75]), yaw: 0.2, pitch: 0.95 },
  bp_wall: { make: glb('items/painting.glb'), yaw: 0.25, pitch: 0.1, vivid: 1.25 },
  bp_decor: {
    make: () => { const flower = (x: number, y: number, c: number) => { const pet: P2[] = Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2, r = 0.2 * (0.6 + 0.4 * Math.abs(Math.cos(a * 2.5))); return [Math.cos(a) * r, Math.sin(a) * r]; });
      return grp(tube([[0, 0.1, 0], [x * 0.5, y * 0.6, 0], [x, y, 0]], 0.035, M(0x3e9a3a, { tex: null }), 12, 5), at(ext(shape(pet), 0.05, M(c, { rough: 0.5 }), 0.03, 2), x, y, 0.04), at(ext(shape(circlePts(0.06, 16)), 0.04, M(0xffd040, { tex: null }), 0.02, 1), x, y, 0.1)); };
      return grp(lathe(smoothProfile([[0, -0.85], [0.36, -0.84], [0.48, -0.5], [0.44, -0.2], [0.2, 0.05], [0.24, 0.16], [0, 0.16]], 3), M(0x3d8fd8, { rough: 0.25 }), 40), flower(-0.3, 0.75, 0xf06a86), flower(0.1, 0.92, 0xffd44a), flower(0.38, 0.64, 0xf5f0ff)); }, yaw: 0.35, pitch: 0.2,
  },
  bp_fun: { make: glb('items/rocking_horse.glb'), yaw: 0.7, pitch: 0.24, vivid: 1.25 },
  bp_wallpaper: { make: () => { const t = stripeTex(); const roll = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.5, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); const sheet = mesh(new THREE.PlaneGeometry(0.9, 1.5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide })); return grp(at(roll, -0.35, 0, 0), at(sheet, 0.4, -0.1, 0.25, -0.2, -0.3, 0), at(cyl(0.1, 0.1, 1.52, C.kraft(), 16), -0.35, 0, 0)); }, yaw: 0.4, pitch: 0.25 },
  bp_floor: { make: () => grp(...[-0.5, 0, 0.5].map((x, i) => at(ext(shape(rrectPts(0.46, 1.5, 0.04)), 0.12, [C.wood(), C.oak(), C.dark()][i], 0.02, 1), x, 0, i === 1 ? 0.06 : 0, -Math.PI / 2))), yaw: 0.5, pitch: 0.6 },
  bp_season: {
    make: () => { const pap = M(0xe0363c, { rough: 0.45 }); return grp(ext(shape(rrectPts(1.1, 0.9, 0.04)), 1.1, pap, 0.03, 2), at(ext(shape(rrectPts(1.18, 0.22, 0.04)), 1.18, pap, 0.03, 2), 0, 0.5, 0), at(ext(shape(rrectPts(0.2, 0.96, 0.02)), 1.14, C.gold(), 0.02, 1), 0, 0.02, 0), at(ext(shape(rrectPts(1.14, 0.96, 0.02)), 0.2, C.gold(), 0.02, 1), 0, 0.02, 0),
      at(torus(0.2, 0.065, C.gold(), Math.PI * 2, 8, 24), -0.18, 0.72, 0, 0, 0.4, 0.4), at(torus(0.2, 0.065, C.gold(), Math.PI * 2, 8, 24), 0.18, 0.72, 0, 0, -0.4, -0.4)); }, yaw: 0.6, pitch: 0.34,
  },
  bp_move: { make: () => ext(shape([[-0.12, 0.12], [-0.12, 0.5], [-0.32, 0.5], [0, 0.9], [0.32, 0.5], [0.12, 0.5], [0.12, 0.12], [0.5, 0.12], [0.5, 0.32], [0.9, 0], [0.5, -0.32], [0.5, -0.12], [0.12, -0.12], [0.12, -0.5], [0.32, -0.5], [0, -0.9], [-0.32, -0.5], [-0.12, -0.5], [-0.12, -0.12], [-0.5, -0.12], [-0.5, -0.32], [-0.9, 0], [-0.5, 0.32], [-0.5, 0.12]]), 0.24, C.sky(), 0.08, 3), yaw: 0.32, pitch: 0.28 },
  bp_buy: {
    make: () => { const sh = shape([[-0.8, -0.5], [0.3, -0.5], [0.85, 0], [0.3, 0.5], [-0.8, 0.5]]); const hl = new THREE.Path(); hl.absarc(0.5, 0, 0.1, 0, Math.PI * 2, true); sh.holes.push(hl);
      const nutS = shape(Array.from({ length: 28 }, (_, i) => { const t = (i / 28) * Math.PI * 2, y = Math.cos(t); return [Math.sin(t) * 0.2 * (y < 0 ? 1 - (-y) * 0.35 : 1), y * 0.24 - 0.04] as P2; }));
      const capS = shape(Array.from({ length: 18 }, (_, i) => { const t = (i / 17) * Math.PI; return [Math.cos(t) * 0.25, Math.sin(t) * 0.14] as P2; }));
      const stamp = grp(at(ext(nutS, 0.04, C.gold(), 0.02, 2), 0, -0.1, 0), at(ext(capS, 0.04, M(0x8a5020, { rough: 0.6, tex: null }), 0.02, 2), 0, 0.08, 0.01));
      return grp(ext(sh, 0.06, M(0xf0c890, { rough: 0.8, tex: 'weave' }), 0.03, 2), at(stamp, -0.25, 0.02, 0.07), tube([[0.5, 0.1, 0], [0.66, 0.46, 0.06], [0.74, 0.86, 0]], 0.035, C.red(), 12, 5)); }, yaw: 0.22, pitch: 0.22,
  },
  // the side tools
  tool_build: {
    make: () => { const head = shape([[-0.62, 0.12], [-0.5, 0.2], [0.1, 0.2], [0.18, 0.26], [0.42, 0.22], [0.66, 0.34], [0.72, 0.28], [0.5, 0.1], [0.4, -0.04], [0.16, -0.06], [0.1, -0.16], [-0.5, -0.16], [-0.62, -0.08]]);
      return at(grp(at(lathe(smoothProfile([[0, -0.95], [0.1, -0.92], [0.12, -0.6], [0.09, -0.1], [0.1, 0.32]], 3), M(0xd08a48, { tex: 'grain', rough: 0.55 }), 16), 0, -0.1, 0), at(ext(head, 0.24, C.steel(), 0.05, 2), -0.12, 0.38, 0), at(cyl(0.06, 0.06, 0.26, C.dark(), 10), 0, 0.38, 0, Math.PI / 2)), 0, 0, 0, 0, 0, 0.55); }, yaw: 0.38, pitch: 0.28,
  },
  tool_shop: {
    make: () => { const wick = M(0xd8a050, { rough: 0.9, tex: 'weave', rep: 2 });
      const apple = at(grp(lathe(smoothProfile([[0, -0.26], [0.18, -0.24], [0.28, -0.06], [0.26, 0.12], [0.12, 0.2], [0.02, 0.16]], 3), M(0xe23a32, { rough: 0.25 }), 24), at(cyl(0.015, 0.02, 0.12, C.dark(), 6), 0.02, 0.24, 0, 0, 0, -0.3), at(leafMesh(0.1, 0.06, C.leaf()), 0.1, 0.26, 0, 0, 0, -1.1)), -0.3, 0.32, 0.12);
      return grp(lathe(smoothProfile([[0, -0.62], [0.62, -0.6], [0.8, -0.2], [0.88, 0.12], [0.86, 0.18], [0.8, 0.16]], 3), wick, 40), at(torus(0.84, 0.05, M(0xb87a3a, { tex: 'grain' }), Math.PI * 2, 8, 40), 0, 0.16, 0, Math.PI / 2), at(torus(0.78, 0.05, M(0xb07a3a, { tex: 'grain' }), Math.PI, 8, 32), 0, 0.15, -0.05),
        apple, at(acorn(0.62, 0.3), 0.24, 0.4, 0.14), at(lathe(smoothProfile([[0, -0.18], [0.24, -0.14], [0.28, 0], [0.2, 0.12], [0, 0.16]], 3), M(0x7ad04a, { rough: 0.4 }), 20), 0.08, 0.26, -0.32, 0, 0, 0.3)); }, yaw: 0.35, pitch: 0.3,
  },
  tool_dress: { make: () => grp(at(hanger(), 0, 0.62, -0.05, 0, 0, 0, 0.75), at(sweater(0xe0457a), 0, -0.25, 0, 0, 0, 0, 0.82)), yaw: 0.3, pitch: 0.15 },
  tool_quests: {
    make: () => { const parch = faceTex('quest', 24, 32, (x, y): RGB => { const base: RGB = [250, 236, 206]; if (y > 6 && y < 24 && y % 4 === 0 && x > 4 && x < 19 - (y % 8 ? 3 : 0)) return hex('#7a6a7a'); return [base[0] - (h2(x, y, 4) > 0.8 ? 8 : 0), base[1] - (h2(x, y, 4) > 0.8 ? 10 : 0), base[2] - 6]; });
      return grp(at(mesh(planarUV(new THREE.PlaneGeometry(1.0, 1.24, 1, 8)), new THREE.MeshStandardMaterial({ map: parch, roughness: 0.85, side: THREE.DoubleSide })), 0, -0.04, 0), at(lathe(smoothProfile([[0.14, -0.62], [0.16, 0], [0.14, 0.62]], 2), M(0xf2dcb2, { tex: 'weave', rough: 0.8 }), 20), 0, 0.64, 0.06, 0, 0, Math.PI / 2), at(lathe(smoothProfile([[0.14, -0.62], [0.16, 0], [0.14, 0.62]], 2), M(0xf2dcb2, { tex: 'weave', rough: 0.8 }), 20), 0, -0.7, 0.06, 0, 0, Math.PI / 2),
        ...[-1, 1].map((s) => at(lathe(smoothProfile([[0, 0], [0.06, 0.02], [0.07, 0.1], [0, 0.14]], 2), C.dark(), 10), s * 0.66, 0.64, 0.06, 0, 0, -s * Math.PI / 2)), at(grp(ext(shape(circlePts(0.19, 32).map(([x, y]) => [x + (h2(Math.round(x * 50), 1, 1) - 0.5) * 0.02, y] as P2)), 0.06, M(0xc8303a, { rough: 0.3 }), 0.04, 2), at(ext(shape(starPts(0.1, 0.045)), 0.03, M(0xe85058, { rough: 0.3 }), 0.01, 1), 0, 0, 0.05)), 0.28, -0.38, 0.08)); }, yaw: 0.3, pitch: 0.2,
  },
  tool_map: {
    make: () => { const face = faceTex('compass', 32, 32, (x, y): RGB => { const dx = x - 15.5, dy = y - 15.5, r = Math.hypot(dx, dy); if (r > 14) return hex('#c8a060'); if (Math.abs(r - 12) < 0.7) return hex('#5a4a3a'); const a = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1; if (r > 9 && r < 12 && Math.abs(a * 8 - Math.round(a * 8)) < 0.12) return hex('#5a4a3a'); return hex('#fbf0d4'); });
      return grp(at(lathe(smoothProfile([[0, -0.12], [0.8, -0.12], [0.88, -0.06], [0.9, 0.06], [0.84, 0.12], [0.76, 0.12]], 3), C.brass(), 48), 0, 0, 0, Math.PI / 2), at(mesh(planarUV(new THREE.CircleGeometry(0.76, 48)), new THREE.MeshStandardMaterial({ map: face, roughness: 0.5 })), 0, 0, 0.1),
        at(ext(shape([[0, 0.6], [0.13, 0], [-0.13, 0]]), 0.04, C.red(), 0.02, 1), 0, 0, 0.15, 0, 0, -0.35), at(ext(shape([[0, -0.6], [0.13, 0], [-0.13, 0]]), 0.04, M(0x3a4a62, { tex: null }), 0.02, 1), 0, 0, 0.15, 0, 0, -0.35),
        at(lathe(smoothProfile([[0, 0.06], [0.07, 0.04], [0.08, 0], [0, 0]], 2), C.brass(), 12), 0, 0, 0.18, Math.PI / 2), at(torus(0.14, 0.045, C.brass(), Math.PI * 2, 8, 24), 0, 0.98, 0), at(cyl(0.08, 0.1, 0.12, C.brass(), 12), 0, 0.88, 0)); }, yaw: 0.28, pitch: 0.2,
  },
  tool_settings: { make: () => grp(at(gear(M(0xeaa634, { metal: 0.55, rough: 0.3, tex: null })), -0.12, 0.1, 0, 0, 0, 0, 0.85), at(gear(M(0xc8d0dc, { metal: 0.6, rough: 0.3, tex: null })), 0.55, -0.55, 0.05, 0, 0, 0.3, 0.42)), yaw: 0.32, pitch: 0.28 },
  // the currency
  owlcoin: { make: () => acornBag(), yaw: 0.3, pitch: 0.2 },
  coin_pouch: { make: () => acornBag({ pouch: 'leather', spill: 1 }), yaw: 0.35, pitch: 0.18 },
  coin_sack: { make: () => grp(at(acornBag({ spill: 0 }), 0, 0, 0, 0, 0, 0, [1.15, 1.1, 1.15]), at(acorn(0.42, 1.2), 0.7, -0.66, 0.4), at(acorn(0.38, -0.8), -0.72, -0.7, 0.3), at(acorn(0.36, 0.2), 0.1, -0.78, 0.7)), yaw: 0.35, pitch: 0.2 },
  coin_chest: {
    make: () => { const wood = M(0xc8783a, { tex: 'grain', rough: 0.55 }), band = M(0x6a5a5a, { metal: 0.6, rough: 0.4, tex: null });
      const lidG = new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24, 1, false, 0, Math.PI); lidG.rotateZ(Math.PI / 2);
      const lid = grp(at(mesh(lidG, wood), 0, 0, 0.42, 0, 0, 0, [1, 0.8, 1]), ...[-0.42, 0.42].map((x) => at(torus(0.425, 0.05, band, Math.PI, 6, 20), x, 0, 0.42, 0, Math.PI / 2, 0, [1, 0.8, 1])));
      lid.position.set(0, 0.02, -0.42); lid.rotation.x = -1.2;
      const heap = grp(...[[-0.35, 0.12, 0.15], [0.0, 0.18, 0.05], [0.32, 0.12, 0.18], [-0.18, 0.26, -0.12], [0.2, 0.28, -0.1], [0.02, 0.36, 0.12], [-0.42, 0.1, -0.2], [0.42, 0.08, -0.22]].map(([x, y, z], i) => at(acorn(0.36, i * 0.9 - 2), x, y, z)));
      return grp(at(ext(shape(rrectPts(1.3, 0.62, 0.05)), 0.84, wood, 0.03, 2), 0, -0.3, 0), lid, heap,
        ...[-0.42, 0.42].map((x) => at(ext(shape(rrectPts(0.1, 0.62, 0.02)), 0.88, band, 0.015, 1), x, -0.3, 0)),
        at(ext(shape(rrectPts(0.22, 0.26, 0.05)), 0.04, C.gold(), 0.02, 2), 0, -0.1, 0.45)); }, yaw: 0.5, pitch: 0.36,
  },
  coin_vault: { make: () => grp(at(acornBag({ spill: 0 }), -0.4, 0.05, -0.3, 0, 0.3, 0, 0.8), at(acornBag({ spill: 0, pouch: 'leather' }), 0.5, -0.05, -0.2, 0, -0.4, 0, 0.7), ...Array.from({ length: 9 }, (_, i) => at(acorn(0.36, i * 0.7), -0.8 + (i % 5) * 0.4, -0.75 + Math.floor(i / 5) * 0.2, 0.4 + (i % 2) * 0.15)), at(moonGem(), 0.1, -0.55, 0.65, 0.2, 0, 0.3, 0.32)), yaw: 0.3, pitch: 0.25 },
  moongem: { make: () => moonGem(), yaw: 0.35, pitch: 0.2 },
};
function hanger(): O {
  return grp(tube([[-0.9, -0.4, 0], [-0.4, -0.12, 0], [0, 0.12, 0], [0.4, -0.12, 0], [0.9, -0.4, 0], [0.82, -0.5, 0], [-0.82, -0.5, 0], [-0.9, -0.4, 0]], 0.08, C.wood(), 64, 8), at(torus(0.2, 0.045, C.brass(), Math.PI * 1.3, 8, 24), 0.05, 0.42, 0, 0, 0, -0.6), at(cyl(0.045, 0.045, 0.14, C.brass(), 8), 0, 0.2, 0));
}
function gear(m: THREE.Material): O {
  const pts: P2[] = [];
  for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2, ph = ((a / (Math.PI * 2)) * 8) % 1, tooth = ph < 0.42 ? 1 : ph < 0.5 ? 1 - (ph - 0.42) / 0.08 : ph > 0.92 ? (ph - 0.92) / 0.08 : 0; const r = 0.7 + 0.22 * tooth; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const s = shape(pts); const hl = new THREE.Path(); hl.absarc(0, 0, 0.24, 0, Math.PI * 2, true); s.holes.push(hl);
  return grp(ext(s, 0.26, m, 0.06, 2, 96), at(torus(0.42, 0.06, m, Math.PI * 2, 8, 40), 0, 0, 0.16));
}
function sweater(col = 0x3fae5a): O {
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
  const cols = ['#e0453c', '#fff0cc', '#3fae5a', '#ffd44a', '#3d7fe0', '#fff0cc', '#e0453c'];
  for (let i = 0; i < cols.length; i++) { g.fillStyle = cols[i]; g.beginPath(); g.arc(32, 32, 32 - i * 4.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('ring', t); return t;
}

// ------------------------------------------------------------------ render + pixel finish
function shoot(obj: O, n: number, yaw: number, pitch: number, pad = 1.04): ImageData {
  const S = n * SS;
  R.setSize(S, S, false);
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length() || 1;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.position.copy(c).addScaledVector(dir, size * 3);
  cam.near = size * 0.1; cam.far = size * 8;
  cam.lookAt(c); cam.updateMatrixWorld();
  const pb = new THREE.Box3();
  // fit the projected bounds of the actual vertices (tighter than the box corners)
  obj.traverse((m) => {
    const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g?.attributes?.position || !m.visible) return;
    let vis = true; m.traverseAncestors((a) => { if (!a.visible) vis = false; });
    if (!vis) return;
    const p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    const step = Math.max(1, Math.floor(p.count / 800));
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(cam.matrixWorldInverse); pb.expandByPoint(v); }
  });
  // leave one art pixel each side for the outline
  const half = (Math.max(pb.max.x - pb.min.x, pb.max.y - pb.min.y) / 2) * pad * (n / (n - 2.2)), mx = (pb.max.x + pb.min.x) / 2, my = (pb.max.y + pb.min.y) / 2;
  cam.left = mx - half; cam.right = mx + half; cam.top = my + half; cam.bottom = my - half;
  cam.updateProjectionMatrix();
  R.render(scene, cam);
  scene.remove(obj);
  const out = document.createElement('canvas');
  out.width = out.height = S;
  const g2 = out.getContext('2d', { willReadFrequently: true })!;
  g2.drawImage(R.domElement, 0, 0);
  return g2.getImageData(0, 0, S, S);
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function rgb(h: number, s: number, l: number): [number, number, number] {
  const f = (p: number, q: number, t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (!s) return [l * 255, l * 255, l * 255];
  const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q2;
  return [f(p, q2, h + 1 / 3) * 255, f(p, q2, h) * 255, f(p, q2, h - 1 / 3) * 255];
}
const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x: number, y: number, s: number) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }

/** The pixel finish: n x n art pixels from the supersampled render. */
function pixelFinish(src: ImageData, n: number, seed: number, vivid = 1): ImageData {
  const S = src.width, sd = src.data, out = new ImageData(n, n), d = out.data;
  const solid = new Uint8Array(n * n);
  const k = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const buckets = new Map<number, [number, number, number, number]>();
    let opaque = 0, tot = 0;
    for (let j = Math.floor(y * k); j < Math.floor((y + 1) * k); j++) for (let i = Math.floor(x * k); i < Math.floor((x + 1) * k); i++) {
      const o = (j * S + i) * 4; tot++;
      if (sd[o + 3] < 128) continue;
      opaque++;
      const key2 = ((sd[o] >> 4) << 8) | ((sd[o + 1] >> 4) << 4) | (sd[o + 2] >> 4);
      const b = buckets.get(key2) ?? [0, 0, 0, 0];
      b[0] += sd[o]; b[1] += sd[o + 1]; b[2] += sd[o + 2]; b[3]++;
      buckets.set(key2, b);
    }
    if (opaque / tot < 0.42) continue;
    let best: [number, number, number, number] | null = null;
    for (const b of buckets.values()) if (!best || b[3] > best[3]) best = b;
    const [r, g, b] = [best![0] / best![3], best![1] / best![3], best![2] / best![3]];
    // a pixel artist's ramp: lightness in a few steps (lightly broken up, like a brush), lights lean gold, shadows violet
    let [h, s, l] = hsl(r, g, b);
    const brush = (vnoise(x * 0.45, y * 0.45, seed) - 0.5) * 0.025;
    const steps = 7;
    let lq = Math.round((l + brush) * steps) / steps;
    lq = clamp(lq * 0.93 + 0.055, 0.05, 0.97);
    const warm = lq - 0.5;
    if (s > 0.08) { const target = warm > 0 ? 0.12 : 0.72; let dh = target - h; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1; h = (h + dh * Math.min(0.08, Math.abs(warm) * 0.18) + 1) % 1; }
    s = clamp(s * 1.28 * vivid + 0.04 * (s > 0.08 ? 1 : 0), 0, 0.95);
    const c = rgb(h, s, lq);
    const o = (y * n + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    solid[y * n + x] = 1;
  }
  // [tex7] clean up like a pixel artist: a lone pixel unlike all four of its neighbours (texture speckle) takes the
  // colour of the neighbour nearest it, so texture reads as clusters and lines, never salt and pepper
  {
    const src = new Uint8ClampedArray(d), dist = (a: number, b: number) => Math.abs(src[a] - src[b]) + Math.abs(src[a + 1] - src[b + 1]) + Math.abs(src[a + 2] - src[b + 2]);
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      if (!solid[y * n + x]) continue;
      const o = (y * n + x) * 4, nb = [o - 4, o + 4, o - n * 4, o + n * 4].filter((q) => src[q + 3] > 0);
      if (nb.length < 4 || nb.some((q) => dist(o, q) < 40)) continue;
      const q = nb.reduce((b, c) => (dist(o, c) < dist(o, b) ? c : b));
      d[o] = src[q]; d[o + 1] = src[q + 1]; d[o + 2] = src[q + 2];
    }
  }
  // a coloured outline: the darkest neighbour, darker and leaning plum; softer on the lit (top-left) side
  const add: [number, number[]][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (solid[y * n + x]) continue;
    let best: number[] | null = null, lit = false, shade = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= n || Y >= n || !solid[Y * n + X]) continue;
      if (dx > 0 || dy > 0) lit = true; else shade = true;
      const o = (Y * n + X) * 4, c = [d[o] * 0.34 + 14, d[o + 1] * 0.26 + 7, d[o + 2] * 0.34 + 22];
      if (!best || c[0] + c[1] + c[2] < best[0] + best[1] + best[2]) best = c;
    }
    if (!best) continue;
    if (lit && !shade) best = [best[0] * 1.25 + 10, best[1] * 1.2 + 6, best[2] * 1.12 + 6];
    add.push([y * n + x, best]);
  }
  for (const [i, c] of add) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  return out;
}

/** glint and twinkle overlays for the currency's idle frames */
function sparkleAt(img: ImageData, x: number, y: number, arm: number, col = [255, 252, 238]) {
  const n = img.width, d = img.data;
  const put = (px: number, py: number, a: number) => { if (px < 0 || py < 0 || px >= n || py >= n) return; const o = (py * n + px) * 4; const t = a / 255; d[o] = d[o] * (1 - t) + col[0] * t; d[o + 1] = d[o + 1] * (1 - t) + col[1] * t; d[o + 2] = d[o + 2] * (1 - t) + col[2] * t; d[o + 3] = Math.max(d[o + 3], a); };
  put(x, y, 255);
  for (let k = 1; k <= arm; k++) { const a = k === arm ? 150 : 225; put(x - k, y, a); put(x + k, y, a); put(x, y - k, a); put(x, y + k, a); }
}
function glint(img: ImageData, f: number) {
  // a bright diagonal band sweeping across the solid pixels on frames 2..5
  const n = img.width, d = img.data, pos = [-99, -99, 0.25, 0.42, 0.6, 0.78, -99, -99][f] * n * 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const o = (y * n + x) * 4;
    if (d[o + 3] < 255) continue;
    const t = Math.abs(x + y - pos);
    if (t < 1.4) { d[o] = d[o] + (255 - d[o]) * 0.55; d[o + 1] = d[o + 1] + (250 - d[o + 1]) * 0.55; d[o + 2] = d[o + 2] + (225 - d[o + 2]) * 0.45; }
  }
}

// ------------------------------------------------------------------ encoding (palette + run-length, base64)
/** cap an image's colours (median cut): pixel art keeps a small palette, and the file stays small */
function capPalette(img: ImageData, max = 64) {
  const d = img.data, px: number[] = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) px.push(i);
  const boxes: number[][] = [px];
  while (boxes.length < max) {
    let bi = -1, bc = 0, br = 0;
    boxes.forEach((b, i) => { if (b.length < 2) return; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (const o of b) { lo = Math.min(lo, d[o + c]); hi = Math.max(hi, d[o + c]); } if (hi - lo > br) { br = hi - lo; bi = i; bc = c; } } });
    if (bi < 0 || br < 6) break;
    const b = boxes[bi].sort((x, y) => d[x + bc] - d[y + bc]), mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  for (const b of boxes) {
    if (!b.length) continue;
    let r = 0, g = 0, bl = 0;
    for (const o of b) { r += d[o]; g += d[o + 1]; bl += d[o + 2]; }
    r /= b.length; g /= b.length; bl /= b.length;
    for (const o of b) { d[o] = r; d[o + 1] = g; d[o + 2] = bl; }
  }
}
function encode(img: ImageData): { w: number; h: number; p: string; d: string } {
  capPalette(img);
  const d = img.data, pal: string[] = [], map = new Map<string, number>(), idx: number[] = [];
  for (let i = 0; i < img.width * img.height; i++) {
    if (d[i * 4 + 3] < 128) { idx.push(0); continue; }
    const h = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    let k = map.get(h);
    if (k === undefined) { k = Math.min(255, pal.length + 1); if (pal.length < 255) { map.set(h, k); pal.push(h); } }
    idx.push(k);
  }
  const bytes: number[] = [];
  for (let i = 0; i < idx.length;) { let j = i; while (j < idx.length && idx[j] === idx[i] && j - i < 255) j++; bytes.push(j - i, idx[i]); i = j; }
  let bin = '';
  for (const v of bytes) bin += String.fromCharCode(v);
  return { w: img.width, h: img.height, p: pal.join(''), d: btoa(bin) };
}

// ------------------------------------------------------------------ the bake
const SIZES = { L: 32, S: 20 };
/** the extra sizes (art px), so an icon can be drawn at exactly one art pixel per artPx() CSS px */
const ZS = [12, 16, 24, 28];
/** extra sizes of the currency's idle frames */
const ANIM_ZS: Record<string, number[]> = { owlcoin: [16, 20, 24], moongem: [16, 20, 24] };
/** the currency's big and animated versions: [name, model, size, frames] */
const ANIM: [string, string, number, number][] = [['owlcoin', 'owlcoin', 32, 8], ['acorn_big', 'owlcoin', 48, 8], ['moongem', 'moongem', 32, 8], ['gem_big', 'moongem', 48, 8], ['coin_vault', 'coin_vault', 44, 4]];
/** names that share a model */
const ALIAS: Record<string, string> = { acorn: 'owlcoin', wd_hanger: 'hanger' };
/** pack sprites are bigger (their sizes in the store) */
const BIG: Record<string, number> = { coin_pouch: 40, coin_sack: 40, coin_chest: 44 };

async function bake() {
  const only = q.get('only');
  const host = document.getElementById('out')!;
  const res: Record<string, unknown> = {};
  const show = (name: string, img: ImageData) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d')!.putImageData(img, 0, 0);
    const fig = document.createElement('figure');
    fig.innerHTML = `<div class="big"></div><div class="one"></div><figcaption>${name}</figcaption>`;
    const big = c.cloneNode() as HTMLCanvasElement; big.getContext('2d')!.drawImage(c, 0, 0); big.style.cssText = `width:${img.width * 3}px;image-rendering:pixelated`;
    fig.querySelector('.big')!.appendChild(big); fig.querySelector('.one')!.appendChild(c);
    host.appendChild(fig);
  };
  const names = Object.keys(ICONS).filter((n) => !only || new RegExp(only).test(n));
  let seed = 1;
  for (const name of names) {
    const sp = ICONS[name];
    try {
      const sizes: Record<string, number> = BIG[name] ? { L: BIG[name] } : SIZES;
      const zs = BIG[name] ? [24, 32] : ZS;
      const out: Record<string, unknown> = {};
      const one = async (n: number) => pixelFinish(shoot(prep(await sp.make()), n, sp.yaw ?? 0.5, sp.pitch ?? 0.3, sp.pad), n, seed, sp.vivid);
      for (const [tag, n] of Object.entries(sizes)) {
        const img = await one(n);
        out[tag] = encode(img);
        if (tag === 'L') show(name, img);
      }
      if (!q.get('fast')) { const z: unknown[] = []; for (const n of zs) z.push(encode(await one(n))); out.z = z; }
      res[name] = out;
    } catch (e) { console.error('bake failed', name, e); }
    seed++;
  }
  for (const [a, b] of Object.entries(ALIAS)) if (res[b] && (!only || new RegExp(only).test(a))) res[a] = res[b];
  // the idle frames: a bob and squash, a glint across the front, twinkles popping round it
  const anim: Record<string, unknown[]> = {}, animZ: Record<string, unknown[][]> = {};
  const frame = async (model: string, n: number, f: number, frames: number) => {
    const sp = ICONS[model];
    const ph = (f / frames) * Math.PI * 2;
    const obj = prep(await sp.make());
    if (frames === 8) { obj.scale.set(1 + Math.sin(ph) * 0.03, 1 - Math.sin(ph) * 0.03, 1); obj.rotation.z = Math.sin(ph + 1) * 0.04; }
    const img = pixelFinish(shoot(obj, n, sp.yaw ?? 0.5, sp.pitch ?? 0.3, (sp.pad ?? 1.04) * 1.04), n, 77);
    if (frames === 8) glint(img, f);
    const tw: [number, number, number][] = [[0.78, 0.16, 2], [0.18, 0.3, 1], [0.82, 0.62, 1], [0.24, 0.12, 2]];
    const t = tw[f % 4];
    if (f % 2 === 0 || frames === 4) sparkleAt(img, Math.round(t[0] * n), Math.round(t[1] * n), Math.max(1, Math.round(t[2] * n / 24)), model === 'moongem' ? [240, 236, 255] : [255, 250, 230]);
    return img;
  };
  for (const [name, model, n, frames] of ANIM) {
    if (only && !new RegExp(only).test(name)) continue;
    const list: unknown[] = [], zl: unknown[][] = [];
    for (let f = 0; f < frames; f++) {
      const img = await frame(model, n, f, frames);
      list.push(encode(img));
      if (f === 2) show(name + '_f2', img);
      if (ANIM_ZS[name] && !q.get('fast')) { const z: unknown[] = []; for (const m of ANIM_ZS[name]) z.push(encode(await frame(model, m, f, frames))); zl.push(z); }
    }
    anim[name] = list;
    if (zl.length) animZ[name] = zl;
  }
  const json = JSON.stringify({ icons: res, anim, animZ });
  const module = `// GENERATED by src/dev/iconbake.ts (/dev-iconbake.html, then window.__module): every interface icon is a small 3D model,
// textured, lit and pixel-finished (see that file). { icons: { name: { L, S, z: [extra sizes] } }, anim: { name: [frames] },
// animZ: { name: [[extra sizes of each frame]] } }; each image is { w, h, p: palette (6 hex digits per colour), d: base64
// run-length pairs (count, palette index; 0 = clear) }.
// Models: the game's own GLBs, the shelf's props (src/ui/chrome/props3d.ts) and models made in the bake; credits for
// borrowed models in docs/credits.
type Img = { w: number; h: number; p: string; d: string };
export const ICONS3D: { icons: Record<string, { L: Img; S?: Img; z?: Img[] }>; anim: Record<string, Img[]>; animZ?: Record<string, Img[][]> } = ${json};
`;
  (window as unknown as { __module: string }).__module = module;
  (window as unknown as { __done: boolean }).__done = true;
  document.title = 'baked ' + Object.keys(res).length;
}
void bake();
