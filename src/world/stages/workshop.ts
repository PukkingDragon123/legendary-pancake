// Barnaby's workshop: the furniture maker's half of the lodge store. Everything is built in code from real proportions
// and dressed in the shop's photo-based pixel textures (fresh-sawn pine, warm boards, end grain, bark) plus painted
// canvases (paper labels, price tags, sawdust):
//   - the workbench he works at, built in HIS OWN frame (so it moves, turns and scales with him) from the numbers in
//     art/shop/craft.py: a laminated top on splayed legs, a wooden face vice on the far side, a holdfast, dog holes, a
//     tool tote with its handle rail, a lower shelf of tins and offcuts;
//   - the plank on it and everything that happens to it as he works (Plank): it slides along before each cut, a pencil
//     line is drawn, the saw kerf deepens, the offcut drops to the floor, a shaving curls out of the plane and falls,
//     mortises are chopped deeper, sawdust piles up under the cut; after a few cuts a fresh plank takes its place;
//   - the tool board on the wall (saws, planes, chisels in a rack, mallet, squares, a bow saw, F-clamps), the timber
//     rack, the shaving horse with its drawknife, the finishing table (glue pot on its burner, varnish tins, brushes),
//     the chair taking shape over the day in its clamps, the cabinet waiting for its doors, the display plinths and the
//     paper price tags on the finished pieces.
// OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../gfx/noise.ts';
import { alagardReady, alagardText } from '../../ui/font.ts';
import { M, contactShadow, logGeo, mat, tex, taperTube } from './lodgekit.ts';

// ------------------------------------------------------------------ the work, in Barnaby's frame (three.js: x, z = -y_blender)
export const BENCH = { top: 0.5, near: 0.237, far: 0.52, x0: -0.62, x1: 0.62, thick: 0.07 };
export const BOARD = { near: 0.25, far: 0.34, top: 0.526, bottom: 0.5, right: -0.88, left: 1.0 };
export const CUT_X = -0.73;
export const MORTISE = { x: 0.32, z: 0.295 };
export const SLIDE = 0.15;
export const TOTE = { x0: 0.065, x1: 0.36, z0: 0.344, z1: 0.432, rail: 0.42, floor: 0.008, wall: 0.035 };
const BZ = (BOARD.near + BOARD.far) / 2;

// ------------------------------------------------------------------ materials
export const W = {
  pine: () => mat('w_pine', () => new THREE.MeshStandardMaterial({ map: tex('plank'), color: 0xd4cec6, roughness: 0.82 })),
  pineAged: () => mat('w_pineAged', () => new THREE.MeshStandardMaterial({ map: tex('plank'), color: 0xc9a986, roughness: 0.85 })),
  benchTop: () => mat('w_benchTop', () => new THREE.MeshStandardMaterial({ map: tex('plank'), color: 0xc2b09a, roughness: 0.7 })),
  boardBack: () => mat('w_boardBack', () => new THREE.MeshStandardMaterial({ map: tex('plank'), color: 0x9c8670, roughness: 0.85 })),
  oak: () => mat('w_oak', () => new THREE.MeshStandardMaterial({ map: tex('board'), roughness: 0.75 })),
  walnut: () => mat('w_walnut', () => new THREE.MeshStandardMaterial({ map: tex('board'), color: 0x8a6650, roughness: 0.6 })),
  beech: () => mat('w_beech', () => new THREE.MeshStandardMaterial({ map: tex('plank'), color: 0xd6bc9c, roughness: 0.7 })),
  varnished: () => mat('w_varnished', () => new THREE.MeshStandardMaterial({ map: tex('plank'), color: 0xd08a4c, roughness: 0.32, envMapIntensity: 1.2 })),
  end: () => mat('w_end', () => new THREE.MeshStandardMaterial({ map: tex('end'), roughness: 0.9 })),
  steel: () => mat('w_steel', () => new THREE.MeshStandardMaterial({ color: 0xb6bcc4, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.4 })),
  blue: () => mat('w_blue', () => new THREE.MeshStandardMaterial({ color: 0x3a4a6a, metalness: 0.6, roughness: 0.45 })),
  iron: () => M.iron(),
  red: () => mat('w_red', () => new THREE.MeshStandardMaterial({ color: 0xb2382c, roughness: 0.5 })),
  graphite: () => mat('w_graphite', () => new THREE.MeshBasicMaterial({ color: 0x3b3a40 })),
  kerf: () => mat('w_kerf', () => new THREE.MeshBasicMaterial({ color: 0x2c1c10 })),
  hole: () => mat('w_hole', () => new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 1 })),
  glass: () => mat('w_glass', () => new THREE.MeshPhysicalMaterial({ color: 0xcfe6e2, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.6 })),
  string: () => mat('w_string', () => new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1 })),
  glue: () => mat('w_glue', () => new THREE.MeshStandardMaterial({ color: 0x7a4a1c, roughness: 0.2, envMapIntensity: 1.3 })),
  flame: () => mat('w_flame', () => new THREE.MeshBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })),
};

// ------------------------------------------------------------------ geometry helpers

type Part = { geo: THREE.BufferGeometry; m: THREE.Matrix4 };
/** add `o` to `g` at (x, y, z) */
const placed = (g: THREE.Object3D, o: THREE.Object3D, x: number, y: number, z: number) => { o.position.set(x, y, z); g.add(o); return o; };
const mx = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

/** UVs in metres on a box-like geometry: the grain runs along `along`; texture tiles 2 m along the grain, 1 m across. */
export function woodUV(g: THREE.BufferGeometry, along: 'x' | 'y' | 'z' = 'x', off = 0): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  const A = { x: 0, y: 1, z: 2 }[along];
  for (let i = 0; i < p.count; i++) {
    const c = [p.getX(i), p.getY(i), p.getZ(i)], nn = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))];
    const face = nn.indexOf(Math.max(...nn));
    // across the grain: the remaining axis that isn't the face normal (or the grain itself)
    const other = [0, 1, 2].find((k) => k !== A && k !== face) ?? (A === 0 ? 1 : 0);
    const u = face === A ? c[(A + 1) % 3] : c[A];
    uv.setXY(i, u / 2 + off, c[other] + off * 0.37);
  }
  return g;
}
function box(w: number, h: number, d: number, along: 'x' | 'y' | 'z' = 'x', bevel = 0.004, off = 0): THREE.BufferGeometry {
  const g = bevel > 0 ? new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, w / 2.2, h / 2.2, d / 2.2)) : new THREE.BoxGeometry(w, h, d);
  return woodUV(g, along, off);
}
function cyl(r0: number, r1: number, len: number, seg = 10): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  const uv = g.attributes.uv as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getY(i) / 2, uv.getX(i) * Math.PI * 2 * Math.max(r0, r1));
  return g;
}
/** a turned part along +y: profile [radius, y] */
function turned(prof: [number, number][], seg = 12): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg);
  const uv = g.attributes.uv as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getY(i) / 2, uv.getX(i) * 0.15);
  return g;
}
function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const gs = parts.map((p) => { const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); g.applyMatrix4(p.m); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; });
  const out = mergeGeometries(gs, false)!;
  for (const g of gs) g.dispose();
  for (const p of parts) p.geo.dispose();
  return out;
}
/** collects parts per material and merges them into one mesh each */
class Builder {
  private by = new Map<THREE.Material, Part[]>();
  add(mat: THREE.Material, geo: THREE.BufferGeometry, m: THREE.Matrix4) { let a = this.by.get(mat); if (!a) this.by.set(mat, (a = [])); a.push({ geo, m }); return this; }
  build(into: THREE.Group, cast = true): THREE.Group {
    for (const [mt, parts] of this.by) { const o = new THREE.Mesh(mergeParts(parts), mt); o.castShadow = cast; o.receiveShadow = true; into.add(o); }
    this.by.clear();
    return into;
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function canvasTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ the workbench (his frame)

/** The workbench: a thick laminated top of warm old boards, four legs braced low (set in from his side so his feet
 * fit under), a wooden face vice on the far side with a big turned screw and its tommy bar, a holdfast, a row of dog
 * holes, a lower shelf with tins and offcuts, and the tool tote where the chisel and the mallet stand. */
export function workbench(seed = 7): THREE.Group {
  const g = new THREE.Group();
  const B = new Builder();
  const T = BENCH, len = T.x1 - T.x0, depth = T.far - T.near, cx = (T.x0 + T.x1) / 2;
  // the top: five laminated strips, each its own piece of board
  const n = 5;
  for (let i = 0; i < n; i++) {
    const zd = depth / n;
    B.add(W.benchTop(), box(len, T.thick, zd - 0.002, 'x', 0.003, i * 0.31), mx(cx, T.top - T.thick / 2, T.near + zd * (i + 0.5)));
  }
  // dog holes along the far strip (square, dark), clear of where the tools lie
  for (const x of [-0.55, -0.43]) B.add(W.hole(), new THREE.PlaneGeometry(0.018, 0.018), mx(x, T.top + 0.0007, T.far - 0.03, -Math.PI / 2));
  // legs (splayed a touch), the far apron under the top, stretchers low, the lower shelf
  const legZ = [0.39, 0.48];
  for (const x of [T.x0 + 0.05, T.x1 - 0.05]) for (const z of legZ) B.add(W.beech(), box(0.062, T.top - T.thick, 0.062, 'y', 0.006, x + z), mx(x, (T.top - T.thick) / 2, z, 0, 0, (x < 0 ? 1 : -1) * 0.015));
  B.add(W.beech(), box(len - 0.06, 0.11, 0.028, 'x', 0.004, 1.3), mx(cx, T.top - T.thick - 0.055, T.far - 0.03));
  for (const z of legZ) B.add(W.beech(), box(len - 0.16, 0.05, 0.04, 'x', 0.004, z * 3), mx(cx, 0.1, z));
  for (const x of [T.x0 + 0.05, T.x1 - 0.05]) B.add(W.beech(), box(0.045, 0.05, legZ[1] - legZ[0] + 0.07, 'z', 0.004, x), mx(x, 0.1, (legZ[0] + legZ[1]) / 2));
  for (let k = 0; k < 3; k++) B.add(W.pineAged(), box(len - 0.2, 0.018, 0.034, 'x', 0.002, k * 0.7), mx(cx, 0.134, legZ[0] + 0.004 + k * 0.036));
  // the face vice on the far side, left part: a chop, a turned screw through it, the tommy bar, a guide bar
  const vx = 0.36, vy = T.top - 0.12;
  B.add(W.oak(), box(0.3, 0.2, 0.05, 'x', 0.008, 2.2), mx(vx, vy, T.far + 0.027));
  const screw = turned([[0.0, 0], [0.034, 0.004], [0.036, 0.03], [0.028, 0.036], [0.026, 0.11], [0.03, 0.115], [0.03, 0.14], [0.0, 0.145]], 14);
  B.add(W.beech(), screw, mx(vx, vy, T.far + 0.05, Math.PI / 2));
  // the thread: a spiral ridge visible on the screw between chop and boss
  const thread = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => new THREE.Vector3(Math.cos(i * 0.9) * 0.027, Math.sin(i * 0.9) * 0.027, 0.04 + i * 0.0023))), 60, 0.004, 4, false);
  B.add(W.beech(), thread, mx(vx, vy, T.far + 0.05));
  B.add(W.beech(), cyl(0.012, 0.012, 0.24, 8), mx(vx, vy, T.far + 0.18, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) B.add(W.beech(), turned([[0.0, 0], [0.018, 0.004], [0.018, 0.02], [0.0, 0.024]], 10), mx(vx + s * 0.12, vy, T.far + 0.18, 0, 0, -s * Math.PI / 2));
  B.add(W.oak(), box(0.03, 0.03, 0.2, 'z', 0.004, 5), mx(vx - 0.1, vy - 0.08, T.far - 0.02));
  // a holdfast in the far dog hole, its arm curling over to the top
  const hf = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.06, 0), new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.07, -0.02), new THREE.Vector3(0, 0.055, -0.07), new THREE.Vector3(0, 0.012, -0.11)]);
  B.add(W.iron(), taperTube(hf, 0.009, 0.007, 16, 7), mx(-0.55, T.top, T.far - 0.03, 0, -0.4));
  // the tool tote: a shallow tray, end posts and a turned handle rail along its far side
  const t = TOTE, tw = t.x1 - t.x0, td = t.z1 - t.z0, tcx = (t.x0 + t.x1) / 2, tcz = (t.z0 + t.z1) / 2;
  B.add(W.pineAged(), box(tw, t.floor, td, 'x', 0.002, 3), mx(tcx, T.top + t.floor / 2, tcz));
  for (const z of [t.z0 + 0.006, t.z1 - 0.006]) B.add(W.pineAged(), box(tw, t.wall, 0.012, 'x', 0.002, z * 7), mx(tcx, T.top + t.wall / 2, z));
  for (const x of [t.x0 + 0.006, t.x1 - 0.006]) {
    B.add(W.pineAged(), box(0.012, t.wall, td - 0.024, 'z', 0.002, x), mx(x, T.top + t.wall / 2, tcz));
    B.add(W.pineAged(), box(0.014, 0.105, 0.03, 'y', 0.003, x * 3), mx(x, T.top + 0.052, t.rail));
  }
  B.add(W.beech(), cyl(0.009, 0.009, tw - 0.01, 10), mx(tcx, T.top + 0.098, t.rail, 0, 0, Math.PI / 2));
  // things on the lower shelf: a box of nails, a can, a stack of offcuts
  B.add(W.pineAged(), box(0.16, 0.06, 0.08, 'x', 0.004, 9), mx(-0.3, 0.173, 0.44));
  for (let k = 0; k < 3; k++) B.add(W.pine(), box(0.22 - k * 0.04, 0.02, 0.07, 'x', 0.002, k * 1.7), mx(0.24 + k * 0.01, 0.153 + k * 0.02, 0.45, 0, (k - 1) * 0.15));
  B.build(g);
  const can = varnishTin(0x2f5d4a, 'BEESWAX', 0.055, 0.05, seed);
  can.position.set(-0.05, 0.143, 0.45);
  g.add(can);
  placed(g, contactShadow(len + 0.3, depth + 0.25, 0.55), cx, 0.004, (T.near + T.far) / 2);
  return g;
}

// ------------------------------------------------------------------ the plank and what happens to it

const SHAVINGS = 40;
/** A pale curled shaving: a thin ribbon wound in a loose helix (its own local frame; scale ~1 = 9 cm long). */
function curlGeo(): THREE.BufferGeometry {
  const pts: number[] = [], idx: number[] = [], uvs: number[] = [];
  const turns = 1.8, n = 26, wid = 0.022;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2, rad = 0.014 * (1 - t * 0.35);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad + rad, z = t * 0.03;
    pts.push(x, y, z - wid / 2, x, y, z + wid / 2);
    uvs.push(t * 0.15, 0, t * 0.15, 0.02);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
const shavingMat = () => mat('w_shaving', () => new THREE.MeshStandardMaterial({ map: tex('plank'), color: 0xfff0d8, roughness: 0.8, side: THREE.DoubleSide }));

interface Fall { obj: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; t: number; floor: number; done: boolean }

/**
 * The plank on the bench (his frame) and the marks of the work on it. Everything is driven by the craft clips' events
 * (beaver.ts) so the line, the kerf, the offcut, the shavings and the mortises happen exactly when his tools do.
 */
export class Plank {
  readonly group = new THREE.Group();     // slides along x with the plank
  private mesh: THREE.Mesh;
  private right = BOARD.right;
  private offset = 0;
  private slide0 = 0;
  private slidePending = false;
  private line: THREE.Mesh;
  private kerfTop: THREE.Mesh;
  private kerfEdge: THREE.Mesh;
  private mortises: { x: number; m: THREE.Mesh; d: number }[] = [];
  private curls: THREE.InstancedMesh;
  private curlState: { live: boolean; p: THREE.Vector3; q: THREE.Quaternion; s: number; v: THREE.Vector3; w: number; age: number }[] = [];
  private nextCurl = 0;
  private growing = -1;
  private falls: Fall[] = [];
  private offcuts: THREE.Mesh[] = [];
  private dust: THREE.Mesh;
  private dustK = 0;
  private cuts = 0;
  private holder: THREE.Group;

  /** `holder` is the bench's frame (his node); the floor pile and the offcuts live there too. */
  constructor(holder: THREE.Group) {
    this.holder = holder;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), W.pine());
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    this.rebuild();
    const quad = (m: THREE.Material) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); q.visible = false; q.renderOrder = 2; this.group.add(q); return q; };
    this.line = quad(W.graphite());
    this.kerfTop = quad(W.kerf());
    this.kerfEdge = quad(W.kerf());
    this.curls = new THREE.InstancedMesh(curlGeo(), shavingMat(), SHAVINGS);
    this.curls.castShadow = true; this.curls.receiveShadow = true;
    this.curls.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < SHAVINGS; i++) { this.curls.setMatrixAt(i, zero); this.curlState.push({ live: false, p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 0, v: new THREE.Vector3(), w: 0, age: 0 }); }
    holder.add(this.curls);
    // the sawdust heap under the cut: a soft decal that grows with every stroke
    this.dust = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.42), new THREE.MeshStandardMaterial({ map: sawdustTex(), transparent: true, depthWrite: false, roughness: 1, opacity: 0 }));
    this.dust.rotation.x = -Math.PI / 2;
    this.dust.position.set(CUT_X - 0.04, 0.003, BZ + 0.02);
    this.dust.renderOrder = 1;
    this.dust.receiveShadow = true;
    holder.add(this.dust);
    holder.add(this.group);
    // a few shavings already on the floor from the morning's work
    const rr = rng(31);
    for (let i = 0; i < 12; i++) this.dropCurlAt(new THREE.Vector3(-0.2 + rr() * 0.9, 0, BOARD.far + 0.12 + rr() * 0.3), rr);
  }

  /** the plank's mesh, from its right end to its left */
  private rebuild() {
    this.mesh.geometry.dispose();
    const len = BOARD.left - this.right, h = BOARD.top - BOARD.bottom, d = BOARD.far - BOARD.near;
    const g = box(len, h, d, 'x', 0.0015, 0.13);
    g.translate((this.right + BOARD.left) / 2, (BOARD.top + BOARD.bottom) / 2, BZ);
    this.mesh.geometry = g;
  }

  /** bench x of a point fixed on the plank */
  private local(xBench: number) { return xBench - this.offset; }

  /** measure clip: the slide before the cut (only after an offcut has dropped) */
  slide(k: number) {
    if (!this.slidePending) return;
    this.offset = this.slide0 - SLIDE * Math.min(1, k);
    this.group.position.x = this.offset;
    if (k >= 1) this.slidePending = false;
  }
  /** measure clip: the pencil line across the plank, drawn from the near edge to the far edge (k 0..1) */
  drawLine(k: number) {
    const x = this.local(CUT_X) + 0.0015, w = BOARD.far - BOARD.near;
    const L = Math.max(0.001, w * Math.min(1, k));
    this.line.visible = k > 0;
    this.line.scale.set(0.0022, L, 1);
    this.line.rotation.set(-Math.PI / 2, 0, 0);
    this.line.position.set(x, BOARD.top + 0.0006, BOARD.near + L / 2);
  }
  /** saw clip: the kerf at the line, k 0..1 of the way through */
  kerf(k: number) {
    const x = this.local(CUT_X), w = BOARD.far - BOARD.near, h = BOARD.top - BOARD.bottom;
    this.kerfTop.visible = this.kerfEdge.visible = k > 0.02;
    const across = Math.min(1, k * 1.6);
    this.kerfTop.scale.set(0.0035, w * across, 1);
    this.kerfTop.rotation.set(-Math.PI / 2, 0, 0);
    this.kerfTop.position.set(x, BOARD.top + 0.0008, BOARD.far - (w * across) / 2);
    const down = Math.min(1, k) * h;
    this.kerfEdge.scale.set(0.0035, down, 1);
    this.kerfEdge.rotation.set(0, 0, 0);
    this.kerfEdge.position.set(x, BOARD.top - down / 2, BOARD.far + 0.0008);
  }
  /** saw clip: the cut is through; the end drops off and tumbles to the floor */
  offcut() {
    const cut = this.local(CUT_X);
    if (cut <= this.right + 0.01) return;
    const len = cut - this.right, h = BOARD.top - BOARD.bottom, d = BOARD.far - BOARD.near;
    const g = box(len, h, d, 'x', 0.0015, 0.13 + this.cuts * 0.21);
    const piece = new THREE.Mesh(g, W.pine());
    piece.castShadow = piece.receiveShadow = true;
    // pivot at the cut's bottom edge (the end tips down off it first)
    const pivot = new THREE.Group();
    pivot.position.set(this.right + len + this.offset, BOARD.bottom, BZ);
    piece.position.set(-len / 2, h / 2, 0);
    pivot.add(piece);
    this.holder.add(pivot);
    this.offcuts.push(piece);
    if (this.offcuts.length > 4) { const o = this.offcuts.shift()!; o.parent?.removeFromParent(); o.geometry.dispose(); }
    this.falls.push({ obj: pivot, v: new THREE.Vector3(-0.25, 0.1, 0.12), w: new THREE.Vector3(0.6, 0.4, 3.2), t: 0, floor: d / 2, done: false });
    this.right = cut;
    this.rebuild();
    this.line.visible = false;
    this.kerfTop.visible = this.kerfEdge.visible = false;
    this.cuts++;
    this.slide0 = this.offset;
    this.slidePending = true;
  }
  /** chisel clip: a mortise chopped a little deeper (in the plank, so it slides along with it) */
  chop(depth: number) {
    const x = this.local(MORTISE.x);
    let mo = this.mortises.find((m) => Math.abs(m.x - x) < 0.01);
    if (!mo) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.05), W.hole().clone() as THREE.MeshStandardMaterial);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, BOARD.top + 0.0009, MORTISE.z);
      m.renderOrder = 2;
      this.group.add(m);
      mo = { x, m, d: 0 };
      this.mortises.push(mo);
    }
    mo.d = depth;
    const k = Math.min(1, depth / 0.016);
    mo.m.scale.set(0.5 + k * 0.5, 0.35 + k * 0.65, 1);
    ((mo.m.material as THREE.MeshStandardMaterial).color).setRGB(0.42 - k * 0.24, 0.27 - k * 0.16, 0.15 - k * 0.09);
  }
  /** a fresh plank (after several cuts the old one is too short for planing): only call while it's hidden by dust */
  freshIfShort(): boolean {
    if (BOARD.left + this.offset > 0.42) return false;
    this.offset = 0; this.right = BOARD.right; this.group.position.x = 0;
    this.slidePending = false;
    for (const m of this.mortises) { m.m.removeFromParent(); m.m.geometry.dispose(); (m.m.material as THREE.Material).dispose(); }
    this.mortises = [];
    this.rebuild();
    return true;
  }
  /** plane clip: a shaving grows out of the plane's mouth at bench x (k 0..1), then drops when the stroke ends */
  shaving(x: number, k: number) {
    if (this.growing < 0) {
      this.growing = this.nextCurl;
      this.nextCurl = (this.nextCurl + 1) % SHAVINGS;
      const st = this.curlState[this.growing];
      st.live = false;
    }
    const st = this.curlState[this.growing];
    st.p.set(x, BOARD.top + 0.035 + k * 0.012, BZ - 0.006);
    st.q.setFromEuler(new THREE.Euler(0.2, Math.PI / 2, -0.3 - k * 0.5));
    st.s = 0.15 + k * 0.9;
    this.setCurl(this.growing);
  }
  /** the stroke is over: the shaving tumbles off the far side to the floor */
  releaseShaving() {
    if (this.growing < 0) return;
    const st = this.curlState[this.growing];
    st.live = true;
    st.age = 0;
    st.v.set((Math.random() - 0.5) * 0.3, 0.45, 0.55 + Math.random() * 0.25);
    st.w = (Math.random() - 0.5) * 9;
    this.growing = -1;
  }
  private dropCurlAt(p: THREE.Vector3, rr: () => number) {
    const i = this.nextCurl;
    this.nextCurl = (this.nextCurl + 1) % SHAVINGS;
    const st = this.curlState[i];
    st.live = false;
    st.p.copy(p).setY(0.002);
    st.q.setFromEuler(new THREE.Euler((rr() - 0.5) * 0.4, rr() * 6.3, (rr() - 0.5) * 0.4));
    st.s = 0.8 + rr() * 0.5;
    this.setCurl(i);
  }
  private setCurl(i: number) {
    const st = this.curlState[i];
    this.curls.setMatrixAt(i, new THREE.Matrix4().compose(st.p, st.q, new THREE.Vector3(st.s, st.s, st.s)));
    this.curls.instanceMatrix.needsUpdate = true;
  }
  /** saw clip: a stroke's worth of sawdust on the heap */
  sawdust() {
    this.dustK = Math.min(1, this.dustK + 0.06);
    const m = this.dust.material as THREE.MeshStandardMaterial;
    m.opacity = 0.25 + this.dustK * 0.75;
    this.dust.scale.setScalar(0.55 + this.dustK * 0.45);
  }
  /** world position of a point given in bench coordinates (for particles) */
  world(x: number, y: number, z: number, out = new THREE.Vector3()) { return this.holder.localToWorld(out.set(x, y, z)); }

  update(dt: number) {
    for (let i = 0; i < SHAVINGS; i++) {
      const st = this.curlState[i];
      if (!st.live) continue;
      st.age += dt;
      st.v.y -= 3.2 * dt;
      st.p.addScaledVector(st.v, dt);
      st.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0.3, 0).normalize(), st.w * dt));
      // it bounces off the bench top if it lands there, else settles on the floor
      const onBench = st.p.x > BENCH.x0 && st.p.x < BENCH.x1 && st.p.z > BENCH.near && st.p.z < BENCH.far;
      const floor = onBench ? BENCH.top + 0.002 : 0.002;
      if (st.p.y <= floor) {
        if (onBench) { st.p.y = floor; st.v.set(st.v.x * 0.5, 0.4, 0.6); }
        else { st.p.y = floor; st.live = false; st.q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * 6.3, (Math.random() - 0.5) * 0.4)); }
      }
      this.setCurl(i);
    }
    for (const f of this.falls) {
      if (f.done) continue;
      f.t += dt;
      if (f.t < 0.28) { f.obj.rotation.z += dt * 3.2; continue; }   // tipping over the cut edge
      f.v.y -= 9 * dt;
      f.obj.position.addScaledVector(f.v, dt);
      f.obj.rotation.x += f.w.x * dt; f.obj.rotation.y += f.w.y * dt; f.obj.rotation.z += f.w.z * dt * 0.4;
      if (f.obj.position.y <= f.floor * 0.6) {
        f.obj.position.y = 0.0;
        // settle flat on the floor, a random turn
        f.obj.rotation.set(0, Math.random() * Math.PI, 0);
        const piece = f.obj.children[0];
        piece.position.set(0, (BOARD.top - BOARD.bottom) / 2, 0);
        f.done = true;
      }
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    for (const q of [this.line, this.kerfTop, this.kerfEdge]) q.geometry.dispose();
    this.curls.geometry.dispose();
    this.dust.geometry.dispose();
    (this.dust.material as THREE.MeshStandardMaterial).map?.dispose();
    (this.dust.material as THREE.Material).dispose();
    for (const o of this.offcuts) o.geometry.dispose();
    for (const m of this.mortises) { m.m.geometry.dispose(); (m.m.material as THREE.Material).dispose(); }
  }
}

let dustT: THREE.Texture | null = null;
/** a soft heap of sawdust seen from above: honey and cream specks, densest in the middle */
export function sawdustTex(): THREE.Texture {
  if (dustT) return dustT;
  const N = 128;
  const [c, g] = canvas(N, N);
  const r = rng(77);
  const cols = ['#e9cf9c', '#d9b57a', '#f3e0b8', '#c99a5c', '#e2c08a'];
  for (let i = 0; i < 2600; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.65) * N * 0.48 * (0.75 + Math.sin(a * 3 + 1) * 0.12 + Math.sin(a * 5) * 0.08);
    const x = Math.round(N / 2 + Math.cos(a) * d), y = Math.round(N / 2 + Math.sin(a) * d);
    g.globalAlpha = Math.min(1, 1.25 - d / (N * 0.48));
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillRect(x, y, r() < 0.2 ? 2 : 1, 1);
  }
  g.globalAlpha = 1;
  dustT = canvasTex(c);
  return dustT;
}

/** a patch of sawdust and chips on the floor (world), r metres across */
export function sawdustPatch(r: number, opacity = 0.9): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r, r * 0.8), mat('w_dustpatch' + opacity.toFixed(2), () => new THREE.MeshStandardMaterial({ map: sawdustTex(), transparent: true, opacity, depthWrite: false, roughness: 1 })));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.003;
  m.renderOrder = 1;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ small tools (for the wall)

/** a bevel-edged chisel, handle up: boxwood handle, brass ferrule, steel blade (its own frame, tip at y = 0) */
function chiselParts(B: Builder, at: THREE.Matrix4, w: number, len: number) {
  const m = (x: number, y: number, z: number) => at.clone().multiply(mx(x, y, z));
  B.add(W.steel(), new THREE.BoxGeometry(w, len * 0.5, 0.004), m(0, len * 0.25, 0));
  B.add(M.brass(), cyl(0.0085, 0.0085, 0.012, 10), m(0, len * 0.52, 0));
  B.add(W.beech(), turned([[0.008, 0], [0.0105, 0.01], [0.012, len * 0.3], [0.0105, len * 0.42], [0.007, len * 0.46], [0.0, len * 0.465]], 10), m(0, len * 0.53, 0));
}

/** an F-clamp: steel bar, fixed and sliding jaws, the screw and a wooden handle (hanging, bar vertical) */
function fClamp(B: Builder, at: THREE.Matrix4, len: number) {
  const m = (x: number, y: number, z: number, rz = 0) => at.clone().multiply(mx(x, y, z, 0, 0, rz));
  B.add(W.steel(), new THREE.BoxGeometry(0.006, len, 0.018), m(0, -len / 2, 0));
  B.add(W.iron(), new RoundedBoxGeometry(0.075, 0.02, 0.02, 1, 0.005), m(0.034, -0.01, 0));
  B.add(W.red(), new RoundedBoxGeometry(0.075, 0.02, 0.02, 1, 0.005), m(0.034, -len * 0.62, 0));
  B.add(W.steel(), cyl(0.004, 0.004, 0.08, 6), m(0.075, -len * 0.62 - 0.04, 0));
  B.add(W.beech(), turned([[0.0, 0], [0.011, 0.004], [0.013, 0.05], [0.01, 0.07], [0.0, 0.072]], 8), m(0.075, -len * 0.62 - 0.08, 0, Math.PI));
}

/** a try square hanging on a peg */
function trySquare(B: Builder, at: THREE.Matrix4) {
  const m = (x: number, y: number, z: number) => at.clone().multiply(mx(x, y, z));
  B.add(W.walnut(), box(0.022, 0.13, 0.016, 'y', 0.002), m(0, -0.065, 0));
  B.add(W.steel(), new THREE.BoxGeometry(0.17, 0.026, 0.002), m(0.095, -0.017, 0));
  for (const y of [-0.025, -0.06, -0.095]) B.add(M.brass(), cyl(0.003, 0.003, 0.018, 6), m(0, y, 0.0));
}

/** a bow saw: two arms, a stretcher, a twisted cord and toggle, a thin blade between the arms */
function bowSaw(B: Builder, at: THREE.Matrix4) {
  const m = (x: number, y: number, z: number, rz = 0) => at.clone().multiply(mx(x, y, z, 0, 0, rz));
  for (const s of [-1, 1]) {
    B.add(W.beech(), box(0.024, 0.34, 0.016, 'y', 0.004), m(s * 0.2, -0.17, 0, s * 0.04));
    B.add(W.beech(), turned([[0.0, 0], [0.012, 0.005], [0.014, 0.05], [0.0, 0.06]], 8), m(s * 0.205, -0.36, 0, Math.PI));
  }
  B.add(W.beech(), box(0.4, 0.02, 0.014, 'x', 0.003), m(0, -0.17, 0));
  B.add(W.steel(), new THREE.BoxGeometry(0.42, 0.016, 0.0012), m(0, -0.32, 0));
  for (const s of [-1, 1]) B.add(W.string(), cyl(0.0022, 0.0022, 0.4, 4), m(s * 0.004, -0.025, 0, Math.PI / 2));
  B.add(W.beech(), box(0.012, 0.13, 0.008, 'y', 0.002), m(0.02, -0.08, 0.008, 0.3));
}

/** a joiner's mallet hanging head-down on a peg */
function malletParts(B: Builder, at: THREE.Matrix4) {
  const m = (x: number, y: number, z: number, rz = 0) => at.clone().multiply(mx(x, y, z, 0, 0, rz));
  B.add(W.beech(), cyl(0.012, 0.014, 0.26, 10), m(0, -0.13, 0));
  B.add(W.beech(), box(0.13, 0.07, 0.07, 'x', 0.006, 0.4), m(0, -0.29, 0));
}

export interface ToolBoard { group: THREE.Group; slots: Record<string, THREE.Vector3> }
/**
 * The tool board on the wall behind his bench (its own frame: x along the wall, y up from the floor, z out from the
 * wall; the board's face at z = 0): tongue-and-groove boards on battens, turned pegs, a shelf for the planes, a rack of
 * chisels, F-clamps on a bar, a bow saw, a try square, a folding rule and a mallet. `slots` are places for the
 * borrowed models the store adds (handsaws, planes, hand drill, hammer).
 */
export function toolBoard(w = 2.7, h = 1.3, y0 = 0.95): ToolBoard {
  const g = new THREE.Group();
  const B = new Builder();
  const nB = Math.round(w / 0.19), bw = w / nB;
  for (let i = 0; i < nB; i++) B.add(W.boardBack(), box(bw - 0.006, h, 0.022, 'y', 0.003, i * 0.43), mx(-w / 2 + bw * (i + 0.5), y0 + h / 2, -0.011));
  for (const y of [y0 + 0.08, y0 + h - 0.08]) B.add(W.walnut(), box(w + 0.06, 0.07, 0.03, 'x', 0.006), mx(0, y, -0.015 - 0.02));
  B.add(W.walnut(), box(w + 0.1, 0.05, 0.05, 'x', 0.008), mx(0, y0 + h + 0.025, 0.0));
  const peg = (x: number, y: number, len = 0.07) => B.add(W.beech(), turned([[0.0, 0], [0.009, 0.004], [0.007, len * 0.7], [0.011, len], [0.0, len + 0.004]], 8), mx(x, y, 0, Math.PI / 2));
  // the plane shelf, on two brackets
  const sx = 0.85, sw = 0.75, sy = y0 + 0.36;
  B.add(W.walnut(), box(sw, 0.03, 0.17, 'x', 0.006), mx(sx, sy, 0.085));
  for (const x of [sx - sw / 2 + 0.06, sx + sw / 2 - 0.06]) B.add(W.walnut(), box(0.03, 0.12, 0.12, 'z', 0.004), mx(x, sy - 0.075, 0.06));
  // the chisel rack: a slotted rail, six chisels hanging blade-down, widest to narrowest
  const rx = 0.0, ry = y0 + 0.86;
  B.add(W.walnut(), box(0.46, 0.035, 0.07, 'x', 0.006), mx(rx, ry, 0.035));
  const widths = [0.032, 0.026, 0.02, 0.016, 0.012, 0.008];
  widths.forEach((cw, i) => chiselParts(B, mx(rx - 0.19 + i * 0.075, ry - 0.135, 0.045), cw, 0.24 - i * 0.008));
  // F-clamps hanging from a steel bar
  const cy = y0 + h - 0.16;
  B.add(W.steel(), cyl(0.006, 0.006, 0.62, 8), mx(-0.75, cy, 0.05, 0, 0, Math.PI / 2));
  for (const x of [-1.04, -0.46]) B.add(W.walnut(), box(0.02, 0.03, 0.05, 'z', 0.004), mx(x, cy, 0.025));
  [0, 1, 2, 3].forEach((k) => fClamp(B, mx(-0.98 + k * 0.15, cy, 0.05), 0.28 + (k % 2) * 0.08));
  // the bow saw, the try square, the folding rule, the mallet on their pegs
  peg(-0.45, y0 + 0.62); bowSaw(B, mx(-0.45, y0 + 0.6, 0.05));
  peg(0.42, y0 + 0.98); trySquare(B, mx(0.42, y0 + 0.97, 0.05));
  peg(0.33, y0 + 0.62); malletParts(B, mx(0.33, y0 + 0.6, 0.06));
  // pegs for the borrowed tools
  const slots: Record<string, THREE.Vector3> = {
    saw1: new THREE.Vector3(-1.12, y0 + 0.52, 0.05), saw2: new THREE.Vector3(-0.92, y0 + 0.5, 0.06),
    plane1: new THREE.Vector3(sx - 0.18, sy + 0.015, 0.09), plane2: new THREE.Vector3(sx + 0.17, sy + 0.015, 0.09),
    drill: new THREE.Vector3(1.18, y0 + 0.98, 0.06), hammer: new THREE.Vector3(1.0, y0 + 0.95, 0.06), hatchet: new THREE.Vector3(-0.18, y0 + 0.55, 0.06),
  };
  for (const k of ['saw1', 'saw2', 'drill', 'hammer', 'hatchet']) peg(slots[k].x, slots[k].y + 0.03);
  B.build(g);
  return { group: g, slots };
}

// ------------------------------------------------------------------ the timber rack, logs, the shaving horse

/** The timber rack along a wall (its own frame: x along the wall, y up, z out from the wall): iron brackets, three
 * levels of seasoning boards of different widths and tones, two barked logs on the bottom. */
export function timberRack(len = 3.2, seed = 3): THREE.Group {
  const g = new THREE.Group();
  const B = new Builder();
  const r = rng(seed);
  const levels = [0.48, 1.08, 1.68];
  for (let x = -len / 2 + 0.2; x <= len / 2 - 0.15; x += 0.92) {
    B.add(W.walnut(), box(0.07, 1.95, 0.05, 'y', 0.006, x), mx(x, 0.975, 0.025));
    for (const y of levels) B.add(W.iron(), new THREE.BoxGeometry(0.03, 0.025, 0.42), mx(x, y - 0.015, 0.23));
  }
  levels.forEach((y, li) => {
    let z = 0.04, h = y;
    const n = 3 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const wd = 0.11 + r() * 0.12, th = 0.022 + r() * 0.03, L = len - 0.15 - r() * 0.5;
      if (z + wd > 0.42) { z = 0.05 + r() * 0.06; h += th + 0.004; }
      B.add(r() < 0.35 ? W.pineAged() : W.pine(), box(L, th, wd, 'x', 0.002, li * 1.3 + k * 0.71), mx((r() - 0.5) * 0.3, h + th / 2, z + wd / 2, 0, (r() - 0.5) * 0.01));
      z += wd + 0.008;
    }
  });
  B.build(g);
  // two barked logs on the floor beneath, their sawn ends showing
  for (const [z, rad] of [[0.22, 0.12], [0.45, 0.1]] as [number, number][]) {
    const lg = new THREE.Mesh(logGeo(1.6, rad, Math.floor(z * 100), 14, false), M.barkLog());
    lg.position.set(-0.3 + z, rad, z);
    lg.castShadow = lg.receiveShadow = true;
    g.add(lg);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.98, 16), W.end());
      cap.position.set(-0.3 + z + s * 0.8, rad, z);
      cap.rotation.y = s * Math.PI / 2;
      g.add(cap);
    }
  }
  return g;
}

/** A shaving horse: a split-plank bench on three splayed legs, the sloping work ramp, the pivoting head on its foot
 * treadle, a chair leg blank in its jaw and the drawknife lying on the ramp (its own frame, long axis along x). */
export function shavingHorse(): THREE.Group {
  const g = new THREE.Group();
  const B = new Builder();
  B.add(W.oak(), box(1.25, 0.06, 0.24, 'x', 0.01, 2), mx(0, 0.5, 0));
  for (const [x, z, sx, sz] of [[-0.5, -0.08, -1, -1], [-0.5, 0.08, -1, 1], [0.52, 0, 1, 0]] as [number, number, number, number][]) {
    B.add(W.oak(), cyl(0.026, 0.022, 0.56, 8), mx(x + sx * 0.06, 0.25, z + sz * 0.06, sz * 0.22, 0, -sx * 0.22));
  }
  // the ramp and its prop
  B.add(W.pine(), box(0.55, 0.04, 0.17, 'x', 0.006, 4), mx(0.18, 0.62, 0, 0, 0, 0.32));
  B.add(W.oak(), box(0.06, 0.16, 0.12, 'y', 0.006), mx(-0.02, 0.58, 0));
  // the head (dumbhead): two uprights through the ramp, a heavy jaw, the treadle bar below
  for (const z of [-0.07, 0.07]) B.add(W.oak(), box(0.04, 0.62, 0.03, 'y', 0.004), mx(0.38, 0.5, z, 0, 0, -0.18));
  B.add(W.oak(), box(0.12, 0.1, 0.22, 'z', 0.01), mx(0.44, 0.83, 0, 0, 0, -0.18));
  B.add(W.oak(), cyl(0.018, 0.018, 0.34, 8), mx(0.27, 0.22, 0, Math.PI / 2));
  // the blank in the jaw, half shaved
  B.add(W.pine(), cyl(0.022, 0.026, 0.42, 7), mx(0.3, 0.72, 0, 0, 0, Math.PI / 2 + 0.32));
  // the drawknife: a long blade with two turned handles at right angles
  B.add(W.steel(), new THREE.BoxGeometry(0.28, 0.003, 0.04), mx(0.05, 0.69, -0.04, 0, 0.1, 0.32));
  for (const s of [-1, 1]) B.add(W.walnut(), turned([[0.0, 0], [0.012, 0.005], [0.014, 0.08], [0.0, 0.09]], 8), mx(0.05 + s * 0.15, 0.71 + s * 0.05, -0.04, Math.PI / 2, 0, 0.32));
  B.build(g);
  g.add(contactShadow(1.4, 0.5, 0.5));
  // shavings under the ramp
  placed(g, sawdustPatch(0.7, 0.85), 0.15, 0.003, 0.05);
  return g;
}

// ------------------------------------------------------------------ the finishing table: glue pot, varnish, brushes

const labelCache = new Map<string, THREE.Texture>();
function labelTex(text: string, col: number, seed: number): THREE.Texture {
  const key = text + col;
  let t = labelCache.get(key);
  if (t) return t;
  const [c, g] = canvas(96, 48);
  const paint = () => {
    const base = '#' + col.toString(16).padStart(6, '0');
    g.fillStyle = base; g.fillRect(0, 0, 96, 48);
    const r = rng(seed);
    for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'; g.fillRect(Math.floor(r() * 96), Math.floor(r() * 48), 1, 1); }
    // the paper label
    g.fillStyle = '#efe2c2'; g.fillRect(14, 10, 68, 28);
    g.fillStyle = '#8a3a26'; g.fillRect(14, 10, 68, 3); g.fillRect(14, 35, 68, 3);
    alagardText(g, text, 48, 30, '#2e2416', { align: 'center' });
    // drips down from the rim
    g.fillStyle = 'rgba(120,70,20,0.6)';
    for (let i = 0; i < 4; i++) { const x = 4 + Math.floor(r() * 88); g.fillRect(x, 0, 2, 3 + Math.floor(r() * 7)); }
  };
  paint();
  t = canvasTex(c);
  void alagardReady().then(() => { paint(); t!.needsUpdate = true; });
  labelCache.set(key, t);
  return t;
}
/** a varnish / oil / wax tin with a painted paper label and a lid (origin at its base) */
export function varnishTin(col: number, text: string, r = 0.05, h = 0.1, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ map: labelTex(text, col, seed), metalness: 0.35, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, true), side);
  body.position.y = h / 2;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.008, 20), W.steel());
  lid.position.y = h + 0.004;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(r, 16), W.steel());
  bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.001;
  g.add(body, lid, bottom);
  g.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.dispose = () => side.dispose();
  return g;
}

/** A small finishing table: a cast-iron glue pot in its water bath over a spirit burner, varnish and oil tins, a jar
 * of brushes, a folded rag, a little box drying on its pins (its own frame, origin at the floor under its centre). */
export function finishingTable(): THREE.Group {
  const g = new THREE.Group();
  const B = new Builder();
  const H = 0.62;
  B.add(W.oak(), box(0.62, 0.035, 0.38, 'x', 0.006), mx(0, H, 0));
  for (const x of [-0.27, 0.27]) for (const z of [-0.15, 0.15]) B.add(W.oak(), box(0.04, H, 0.04, 'y', 0.004), mx(x, H / 2, z));
  B.add(W.oak(), box(0.5, 0.025, 0.3, 'x', 0.004), mx(0, 0.14, 0));
  // the glue pot: a burner (brass) on a tile, the outer water pot, the inner glue pot with its brush
  B.add(M.brass(), cyl(0.04, 0.045, 0.05, 14), mx(-0.15, H + 0.042, 0.02));
  B.add(W.iron(), turned([[0.0, 0], [0.07, 0.0], [0.075, 0.02], [0.075, 0.09], [0.082, 0.095], [0.0, 0.095]], 16), mx(-0.15, H + 0.07, 0.02));
  B.add(W.iron(), turned([[0.0, 0], [0.05, 0.0], [0.052, 0.1], [0.058, 0.105], [0.0, 0.105]], 14), mx(-0.15, H + 0.09, 0.02));
  B.add(W.glue(), new THREE.CircleGeometry(0.049, 14), mx(-0.15, H + 0.19, 0.02, -Math.PI / 2));
  B.add(W.walnut(), cyl(0.005, 0.005, 0.2, 6), mx(-0.13, H + 0.25, 0.02, 0, 0, -0.35));
  // the brush jar (glass) with three brushes
  B.add(W.glass(), new THREE.CylinderGeometry(0.035, 0.032, 0.11, 16, 1, true), mx(0.18, H + 0.073, 0.08));
  [[-0.012, 0.2], [0.012, -0.15], [0.0, 0.05]].forEach(([dx, rz], i) => {
    B.add(W.walnut(), cyl(0.006, 0.006, 0.2, 6), mx(0.18 + dx, H + 0.13, 0.08 + dx, 0, 0, rz));
    B.add(M.brass(), cyl(0.007, 0.007, 0.02, 8), mx(0.18 + dx - Math.sin(rz) * -0.0, H + 0.04 + 0.0, 0.08 + dx, 0, 0, rz));
    B.add(mat('w_bristle' + i, () => new THREE.MeshStandardMaterial({ color: [0x3a2a1e, 0xc8a46a, 0x6a4a2a][i], roughness: 1 })), box(0.018, 0.03, 0.008, 'y', 0.002), mx(0.18 + dx, H + 0.03, 0.08 + dx, 0, 0, rz));
  });
  // a folded rag
  B.add(mat('w_rag', () => new THREE.MeshStandardMaterial({ color: 0xc9b8a0, roughness: 1 })), box(0.12, 0.018, 0.09, 'x', 0.008), mx(0.02, H + 0.027, -0.11, 0, 0.3));
  B.build(g);
  const tins: [number, string, number, number, number, number][] = [[0x7a3b22, 'VARNISH', 0.045, 0.1, 0.07, 0.1], [0x2f4f6a, 'LINSEED', 0.04, 0.12, 0.0, -0.08], [0x6a5a22, 'SHELLAC', 0.032, 0.07, -0.02, 0.07]];
  tins.forEach(([col, text, r, h, x, z], i) => { const t = varnishTin(col, text, r, h, i + 3); t.position.set(x, H + 0.018, z); t.rotation.y = i * 1.3; g.add(t); });
  // the burner's little blue flame (seen under the pot at night)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8), W.flame());
  flame.position.set(-0.15, H + 0.08, 0.02);
  g.add(flame);
  g.add(contactShadow(0.8, 0.55, 0.5));
  return g;
}

// ------------------------------------------------------------------ work in progress: the chair, the cabinet

/** The chair he is building today (its own frame, origin on the floor at its centre, facing +z), at a stage that
 * follows the hour: 0 parts laid out, 1 the base glued up in sash clamps, 2 the seat on, 3 the back going in, still
 * clamped, 4 finished and oiled. */
export function chairInProgress(stage: number): THREE.Group {
  const g = new THREE.Group();
  const B = new Builder();
  const wood = stage >= 4 ? W.varnished() : W.pine();
  const H = 0.44, sw = 0.42, sd = 0.4;
  const leg = (x: number, z: number, h: number) => B.add(wood, turned([[0.016, 0], [0.019, 0.04], [0.017, h * 0.4], [0.021, h * 0.45], [0.018, h * 0.55], [0.02, h * 0.98], [0.0, h]], 10), mx(x, 0, z));
  if (stage === 0) {
    // the parts laid out on a pair of trestle boards: legs, rails, the seat blank
    for (let k = 0; k < 4; k++) B.add(wood, cyl(0.02, 0.02, 0.44, 8), mx(-0.15 + k * 0.1, 0.022, 0.05, 0, 0, Math.PI / 2));
    for (let k = 0; k < 3; k++) B.add(wood, box(0.36, 0.022, 0.022, 'x', 0.003), mx(0.05, 0.011, -0.15 + k * 0.05));
    B.add(wood, box(0.42, 0.03, 0.36, 'x', 0.004), mx(0.0, 0.015, 0.4));
    B.build(g);
    return g;
  }
  for (const x of [-sw / 2 + 0.03, sw / 2 - 0.03]) {
    leg(x, sd / 2 - 0.03, H);
    leg(x, -sd / 2 + 0.03, stage >= 3 ? 0.9 : H);
  }
  // rails and stretchers
  for (const y of [0.13, H - 0.04]) {
    for (const z of [sd / 2 - 0.03, -sd / 2 + 0.03]) B.add(wood, box(sw - 0.06, 0.03, 0.02, 'x', 0.003), mx(0, y, z));
    for (const x of [sw / 2 - 0.03, -sw / 2 + 0.03]) B.add(wood, box(0.02, 0.03, sd - 0.06, 'z', 0.003), mx(x, y, 0));
  }
  if (stage >= 2) B.add(wood, box(sw + 0.02, 0.03, sd + 0.02, 'x', 0.008), mx(0, H + 0.015, 0));
  if (stage >= 3) {
    B.add(wood, box(sw - 0.04, 0.07, 0.024, 'x', 0.006), mx(0, 0.84, -sd / 2 + 0.03));
    for (let k = 0; k < 3; k++) B.add(wood, box(0.04, 0.3, 0.014, 'y', 0.003), mx(-0.1 + k * 0.1, 0.65, -sd / 2 + 0.03));
  }
  // sash clamps holding the glue-up
  if (stage >= 1 && stage <= 3) {
    const clamp = (y: number, z: number) => {
      B.add(W.blue(), new THREE.BoxGeometry(sw + 0.2, 0.024, 0.008), mx(0, y, z));
      for (const s of [-1, 1]) B.add(W.blue(), new THREE.BoxGeometry(0.024, 0.06, 0.024), mx(s * (sw / 2 + 0.01), y - 0.02, z));
      B.add(W.steel(), cyl(0.004, 0.004, 0.08, 6), mx(sw / 2 + 0.07, y - 0.02, z, 0, 0, Math.PI / 2));
      B.add(W.beech(), box(0.012, 0.05, 0.012, 'y', 0.002), mx(sw / 2 + 0.11, y - 0.02, z));
    };
    clamp(H - 0.01, sd / 2 + 0.02);
    clamp(0.15, -sd / 2 - 0.02);
    // glue squeeze-out at the joints: little amber beads
    for (const x of [-sw / 2 + 0.03, sw / 2 - 0.03]) B.add(W.glue(), new THREE.SphereGeometry(0.006, 6, 4), mx(x + (x < 0 ? 0.02 : -0.02), H - 0.025, sd / 2 - 0.02));
  }
  B.build(g);
  g.add(contactShadow(0.7, 0.6, 0.5));
  return g;
}

/** A cabinet carcass waiting for its doors (its own frame, back against z = 0, front toward +z): pale pine sides, top,
 * bottom and a shelf, a plank back, the two frame-and-panel doors leaning against it, hinges in a tin tray. */
export function carcass(): THREE.Group {
  const g = new THREE.Group();
  const B = new Builder();
  const w = 0.62, h = 0.86, d = 0.36, t = 0.022;
  for (const s of [-1, 1]) B.add(W.pine(), box(t, h, d, 'y', 0.003, s), mx(s * (w / 2 - t / 2), h / 2 + 0.06, d / 2));
  for (const y of [0.06 + t / 2, h + 0.06 - t / 2, 0.48]) B.add(W.pine(), box(w - 2 * t, t, d - 0.01, 'x', 0.003, y * 5), mx(0, y, d / 2 + 0.005));
  B.add(W.pineAged(), box(w, h, 0.012, 'y', 0.002, 2.2), mx(0, h / 2 + 0.06, 0.006));
  B.add(W.pine(), box(w - 0.04, 0.06, 0.02, 'x', 0.003, 0.9), mx(0, 0.03, d - 0.02));
  // two doors leaning on its side: stiles, rails and a raised panel each
  for (let k = 0; k < 2; k++) {
    const dg: Part[] = [];
    const dw = 0.3, dh = 0.8;
    dg.push({ geo: box(0.05, dh, 0.022, 'y', 0.003, k), m: mx(-dw / 2 + 0.025, dh / 2, 0) }, { geo: box(0.05, dh, 0.022, 'y', 0.003, k + 0.5), m: mx(dw / 2 - 0.025, dh / 2, 0) });
    dg.push({ geo: box(dw - 0.1, 0.06, 0.022, 'x', 0.003, k + 1), m: mx(0, 0.03, 0) }, { geo: box(dw - 0.1, 0.06, 0.022, 'x', 0.003, k + 2), m: mx(0, dh - 0.03, 0) });
    dg.push({ geo: box(dw - 0.1, dh - 0.12, 0.014, 'y', 0.006, k + 3), m: mx(0, dh / 2, 0) });
    const door = new THREE.Mesh(mergeParts(dg), W.pine());
    door.castShadow = door.receiveShadow = true;
    door.position.set(w / 2 + 0.06 + k * 0.05, 0, 0.2 + k * 0.05);
    door.rotation.set(-0.0, -Math.PI / 2 + 0.1, -0.12 - k * 0.02);
    g.add(door);
  }
  // a tray of brass hinges on the shelf
  B.add(W.steel(), box(0.14, 0.02, 0.08, 'x', 0.003), mx(0.1, 0.48 + t / 2 + 0.01, d / 2 + 0.03));
  for (let k = 0; k < 4; k++) B.add(M.brass(), new THREE.BoxGeometry(0.03, 0.004, 0.05), mx(0.06 + k * 0.025, 0.48 + t / 2 + 0.022, d / 2 + 0.03, 0, k * 0.2));
  B.build(g);
  placed(g, contactShadow(w + 0.4, d + 0.4, 0.5), 0.1, 0.004, d / 2);
  return g;
}

// ------------------------------------------------------------------ the shop: display plinths and price tags

/** A display plinth for one of today's deals: a stepped platform of oiled boards on a dark plinth, brass corners
 * (its own frame, origin on the floor; `h` is its top). */
export function plinth(h: number, w = 0.52, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const B = new Builder();
  B.add(W.walnut(), box(w + 0.06, 0.06, w + 0.06, 'x', 0.008, seed), mx(0, 0.03, 0));
  B.add(W.walnut(), box(w - 0.04, h - 0.1, w - 0.04, 'y', 0.01, seed * 0.7), mx(0, 0.06 + (h - 0.1) / 2, 0));
  B.add(W.oak(), box(w + 0.04, 0.04, w + 0.04, 'x', 0.01, seed * 1.3), mx(0, h - 0.02, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(M.brass(), new THREE.BoxGeometry(0.03, 0.03, 0.03), mx(sx * (w / 2 + 0.02), h - 0.02, sz * (w / 2 + 0.02)));
  B.build(g);
  g.add(contactShadow(w * 1.6, w * 1.6, 0.55));
  g.userData.top = h;
  return g;
}

/** A kraft-paper price tag hanging on a string (its own frame: the string's top at the origin, the tag below). */
export function priceTag(price: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const [c, gx] = canvas(64, 40);
  const paint = () => {
    gx.fillStyle = '#d8b27c'; gx.fillRect(0, 0, 64, 40);
    const r = rng(seed);
    for (let i = 0; i < 180; i++) { gx.fillStyle = r() < 0.5 ? 'rgba(120,80,40,0.18)' : 'rgba(255,240,210,0.2)'; gx.fillRect(Math.floor(r() * 64), Math.floor(r() * 40), 1, 1); }
    gx.fillStyle = '#8a5a30'; gx.fillRect(0, 0, 64, 1); gx.fillRect(0, 39, 64, 1); gx.fillRect(0, 0, 1, 40); gx.fillRect(63, 0, 1, 40);
    // the punched hole with its reinforcing ring
    gx.fillStyle = '#efe0c0'; gx.fillRect(4, 16, 8, 8);
    gx.fillStyle = '#3a2a18'; gx.fillRect(6, 18, 4, 4);
    // a little acorn and the price in ink
    gx.fillStyle = '#6a4220'; gx.fillRect(19, 15, 7, 3); gx.fillStyle = '#b8772f'; gx.fillRect(20, 18, 5, 6); gx.fillRect(21, 24, 3, 1);
    alagardText(gx, String(price), 44, 27, '#2a1e12', { align: 'center' });
  };
  paint();
  const t = canvasTex(c);
  void alagardReady().then(() => { paint(); t.needsUpdate = true; });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.056), m);
  tag.position.set(0.03, -0.075, 0);
  tag.rotation.z = -0.25;
  tag.castShadow = true;
  const str = new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.004, -0.025, 0.002), new THREE.Vector3(-0.004, -0.05, 0)]), 0.0015, 0.0015, 6, 4), W.string());
  g.add(tag, str);
  g.userData.dispose = () => { t.dispose(); m.dispose(); tag.geometry.dispose(); str.geometry.dispose(); };
  g.userData.tag = tag;
  return g;
}
