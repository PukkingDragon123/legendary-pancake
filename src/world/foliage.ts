// [look4] Bushy, hand-pixelled foliage for every tree, bush, hedge and fern in the world.
//
// The leaves are one atlas (public/textures/leaves.webp, painted leaf by leaf by art/leaves/paint.ts): 4 x 4 cells of
// dense leaf clusters (oak, fresh oak, maple, birch; below them their autumn amber, copper, crimson and gold; cherry
// blossom; fir and pine sprays; a fern frond; elder in flower; boxwood; holly with berries; lilac).
// Canopies are built from many alpha-cut leaf-cluster cards scattered over a set of "puffs" (spheres), with
//   - bent normals: every corner's normal points away from the crown's centre, so the cards light as one rounded,
//     bumpy mass (bright crown tops and sun side, cool undersides) instead of flat blobs,
//   - baked depth: cards deeper in the crown and underneath are darker (vertex colour),
//   - an inner hull per puff (the dense centre of the same leaf cell, deep in shadow) so a crown never reads as
//     see-through,
//   - sun translucency and a rim light on the edges, and BUSHED's wind (aWind) for sway, bob and flutter,
//   - a per-instance `iLeaf` attribute: 1 shows the cell's autumn colour (the row below), -1 hides the leaves (bare
//     winter trees), 0 as built.
//
// API (all geometry in model units, origin on the ground, +Y up):
//   leafMaterial()                       shared material set { mat, depth } (MeshStandardMaterial, wind, alpha cut)
//   canopy(puffs, opts)                  a broadleaf crown / bush / hedge from puffs
//   conifer(opts)                        tiers of needle sprays round a trunk, with a dark inner cone
//   fronds(opts)                         a fern / leafy clump of arching cards from one root
//   puffsFromPoints(points, opts)        cluster a point cloud (e.g. a tree skeleton's leaf positions) into puffs
//   withLeafState(geo, count)            a geometry view with the per-instance iLeaf attribute for an InstancedMesh
import * as THREE from 'three';
import { MeshBuilder, v3, type Col, type V3 } from './bushed/geom.ts';
import { bushedDepth, patchBushed, type TreeUniforms } from './bushed/materials.ts';
import { Rng } from './bushed/rng.ts';

/** Atlas cells (row-major, 4 x 4; row 1 holds the autumn colours of row 0). */
export const LEAF = {
  oak: 0, oakFresh: 1, maple: 2, birch: 3,
  amber: 4, copper: 5, crimson: 6, gold: 7,
  blossom: 8, fir: 9, pine: 10, fern: 11,
  elder: 12, hedge: 13, holly: 14, lilac: 15,
} as const;
export type LeafCell = keyof typeof LEAF;

/** uv rect [u0, v0, u1, v1] of a cell (v up), inset by `inset` of the cell on every side */
export function leafRect(cell: LeafCell | number, inset = 0): [number, number, number, number] {
  const i = typeof cell === 'number' ? cell : LEAF[cell];
  const c = i % 4, r = Math.floor(i / 4), s = 0.25, e = 0.5 / 1024 + inset * s;
  return [c * s + e, 1 - (r + 1) * s + e, (c + 1) * s - e, 1 - r * s - e];
}

let texture: THREE.Texture | null = null;
let readyFn: (() => void) | null = null;
/** Resolves when the leaf atlas has loaded (or failed). */
export const leavesReady = new Promise<void>((res) => { readyFn = res; });
/** The leaf atlas (smoothly filtered, mipmapped far away). */
export function leafTexture(): THREE.Texture {
  if (texture) return texture;
  const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/leaves.webp`, () => readyFn?.(), undefined, () => readyFn?.());
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; // [light7] no pixelated look
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return (texture = t);
}

export interface LeafMaterial { mat: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial; uniforms: TreeUniforms & { uRim: { value: number }; uNearFade: { value: number } } }
let shared: LeafMaterial | null = null;

/** The shared foliage material: BUSHED's wind and translucency, plus alpha that holds up in the far mips, a sun rim
 * on the edges, and the per-instance autumn / bare switch. */
export function leafMaterial(): LeafMaterial {
  if (shared) return shared;
  const map = leafTexture();
  // uNearFade: leaves closer to the camera than this dissolve (a camera flying past a crown never sees the inside of it)
  const uniforms = { uWindAmt: { value: 1 }, uRim: { value: 0.55 }, uNearFade: { value: 3.2 } };
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
  mat.name = 'leaves';
  patchBushed(mat, 'foliage', uniforms, { translucency: 0.7, backTint: new THREE.Color(1.05, 1.1, 0.9) });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    sh.uniforms.uRim = uniforms.uRim;
    sh.uniforms.uNearFade = uniforms.uNearFade;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float iLeaf;\nvarying float vLfCam;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvLfCam = -mvPosition.z;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_MAP
        if (iLeaf > 0.5 && vMapUv.y > 0.75) vMapUv.y -= 0.25;
        #endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        if (iLeaf < -0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform float uNearFade;\nvarying float vLfCam;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          vec2 lfP = floor(gl_FragCoord.xy);
          float lfB = fract(dot(lfP, vec2(0.5, 0.25)) + 0.125 * mod(lfP.x, 2.0));
          if (vLfCam < uNearFade + lfB * 1.6) discard;
        }`)
      // keep the far mips as full as the near ones: boost alpha by the mip level the texel lands on
      .replace('#include <alphatest_fragment>', `
        #ifdef USE_MAP
        {
          vec2 lfD = vMapUv * 1024.0;
          vec2 lfX = dFdx(lfD), lfY = dFdy(lfD);
          float lfLod = max(0.0, 0.5 * log2(max(dot(lfX, lfX), dot(lfY, lfY))));
          diffuseColor.a *= 1.0 + lfLod * 0.3;
        }
        #endif
        #include <alphatest_fragment>`)
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
        #if NUM_DIR_LIGHTS > 0
        {
          // a warm rim where the crown turns away from the viewer on the sun's side
          float lfRim = pow(1.0 - abs(dot(normal, geometryViewDir)), 3.0);
          float lfSun = max(dot(normal, directLight.direction), 0.0) * 0.6 + 0.4;
          reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * lfRim * lfSun * uRim;
        }
        #endif`);
  };
  const key = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => key.call(mat) + '|leaves';
  const depth = bushedDepth(uniforms, map);
  const dBase = depth.onBeforeCompile;
  depth.onBeforeCompile = (sh, r) => {
    dBase.call(depth, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float iLeaf;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nif (iLeaf < -0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
  };
  const dKey = depth.customProgramCacheKey;
  depth.customProgramCacheKey = () => dKey.call(depth) + '|leaves';
  return (shared = { mat, depth, uniforms });
}

/** A geometry view over `geo` (shared buffers) with a per-instance iLeaf attribute, for one InstancedMesh. */
export function withLeafState(geo: THREE.BufferGeometry, count: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a);
  g.setIndex(geo.index);
  g.boundingBox = geo.boundingBox; g.boundingSphere = geo.boundingSphere;
  g.setAttribute('iLeaf', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
  return g;
}

// ------------------------------------------------------------------ builders

export interface Puff { x: number; y: number; z: number; r: number; sy?: number }
export interface CanopyOpts {
  /** leaf cells the cards pick from (weights by repetition) */
  cells: LeafCell[];
  seed: number;
  /** card edge length (model units) */
  size: number;
  /** cards per puff surface area / card area (2 = every point of a puff's skin covered about twice) */
  cover?: number;
  /** inner hulls (default on) */
  core?: boolean;
  /** crown centre for the bent normals (default: the puffs' centroid) */
  centre?: V3;
  /** the crown's height above the ground (for the wind's trunk sway weight; default the top of the puffs) */
  height?: number;
  /** trunk sway (fraction of height at full wind), leaf flutter */
  sway?: number; flutter?: number;
  /** brightness of the deepest cards (0..1, default 0.42) */
  depthDark?: number;
  /** keep cards off the ground (bushes): y >= floor */
  floor?: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const tv = new THREE.Vector3(), tw = new THREE.Vector3();

/** Push one leaf card (a flat quad) with per-corner bent normals and depth shading. */
function leafCard(mb: MeshBuilder, p: V3, n: V3, spin: number, w: number, h: number, rect: [number, number, number, number],
  centre: V3, radius: number, sy: number, shade: (q: V3) => number, tint: Col, wind: (q: V3, tip: boolean) => [number, number, number, number], flip: boolean) {
  // basis in the card plane
  const a = Math.abs(n.y) < 0.95 ? UP : new THREE.Vector3(1, 0, 0);
  const s = a.clone().cross(n).normalize(), u = n.clone().cross(s).normalize();
  const cs = Math.cos(spin), sn = Math.sin(spin);
  const ax = s.clone().multiplyScalar(cs).addScaledVector(u, sn), ay = u.clone().multiplyScalar(cs).addScaledVector(s, -sn);
  const [u0, v0, u1, v1] = rect;
  const corners: [number, number, number, number][] = [[-1, -1, flip ? u1 : u0, v0], [1, -1, flip ? u0 : u1, v0], [1, 1, flip ? u0 : u1, v1], [-1, 1, flip ? u1 : u0, v1]];
  const ids = corners.map(([cx, cy, uu, vv]) => {
    const q = p.clone().addScaledVector(ax, cx * w * 0.5).addScaledVector(ay, cy * h * 0.5);
    // the normal of a rounded crown at this corner (squashed puffs keep their shape in the light)
    const nn = tv.copy(q).sub(centre);
    nn.y /= sy;
    nn.normalize().multiplyScalar(0.85).addScaledVector(n, 0.15).normalize();
    const k = shade(q);
    return mb.vert(q, nn.clone(), uu, vv, [tint[0] * k, tint[1] * k, tint[2] * k], wind(q, cy > 0));
  });
  mb.quad(ids[0], ids[1], ids[2], ids[3]);
  void radius;
}

/** A low-poly hull (icosahedron) inside a puff, wearing the dense middle of a leaf cell, deep in shadow. */
function hull(mb: MeshBuilder, pf: Puff, rect: [number, number, number, number], centre: V3, sy: number, k: number, tint: Col, wind: (q: V3, tip: boolean) => [number, number, number, number]) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const [u0, v0, u1, v1] = rect;
  const idx: number[] = [];
  const ys = pf.sy ?? 1;
  for (let i = 0; i < pos.count; i++) {
    const d = tv.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const q = v3(pf.x + d.x * pf.r * 0.66, pf.y + d.y * pf.r * 0.66 * ys, pf.z + d.z * pf.r * 0.66);
    const nn = tw.copy(q).sub(centre); nn.y /= sy; nn.normalize();
    // spherical uvs into the middle of the cell (the densest leaves)
    const uu = 0.5 + Math.atan2(d.z, d.x) / (Math.PI * 2), vv = 0.5 + Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI;
    const cu = u0 + (u1 - u0) * (0.3 + 0.4 * ((uu * 3) % 1)), cv = v0 + (v1 - v0) * (0.3 + 0.4 * vv);
    const sh = k * (0.75 + 0.25 * Math.max(0, d.y));
    idx.push(mb.vert(q, nn.clone(), cu, cv, [tint[0] * sh, tint[1] * sh, tint[2] * sh], wind(q, false)));
  }
  // non-indexed icosahedron: every 3 vertices are a face
  for (let i = 0; i < idx.length; i += 3) mb.tri(idx[i], idx[i + 1], idx[i + 2]);
  g.dispose();
}

/** A broadleaf crown, bush or hedge: leaf cards over the skins of the puffs, bent normals, inner hulls. */
export function canopy(puffs: Puff[], o: CanopyOpts): THREE.BufferGeometry {
  return canopyBuilder(puffs, o).build({ moss: false });
}

export function canopyBuilder(puffs: Puff[], o: CanopyOpts): MeshBuilder {
  const rng = new Rng(o.seed * 7919 + 13);
  const mb = new MeshBuilder();
  let wsum = 0;
  const c = v3();
  let top = 0, rad = 0;
  for (const p of puffs) { const w = p.r ** 3; c.x += p.x * w; c.y += p.y * w; c.z += p.z * w; wsum += w; top = Math.max(top, p.y + p.r * (p.sy ?? 1)); }
  c.multiplyScalar(1 / Math.max(1e-6, wsum));
  if (o.centre) c.copy(o.centre);
  for (const p of puffs) rad = Math.max(rad, Math.hypot(p.x - c.x, p.z - c.z) + p.r, (p.y - c.y) + p.r);
  // crowns are wider than tall: squash the shading sphere to match
  let ext = 0;
  for (const p of puffs) ext = Math.max(ext, Math.abs(p.y - c.y) + p.r * (p.sy ?? 1));
  const sy = Math.max(0.45, Math.min(1.2, ext / Math.max(0.01, rad)));
  const H = o.height ?? top;
  const sway = (o.sway ?? 0.03) * H, flutter = o.flutter ?? 1;
  const dark = o.depthDark ?? 0.42;
  const phase = rng.next();
  const wind = (q: V3, tip: boolean): [number, number, number, number] => {
    const hk = Math.max(0, Math.min(1, q.y / Math.max(0.01, H)));
    return [sway * hk * hk * 1.4, Math.hypot(q.x - c.x, q.z - c.z) * 0.08 + 0.02, tip ? flutter : flutter * 0.2, (phase + q.x * 0.13 + q.z * 0.07) % 1];
  };
  const shade = (q: V3) => {
    tv.copy(q).sub(c); tv.y /= sy;
    const out = Math.min(1, tv.length() / Math.max(0.01, rad));
    const under = Math.max(0, Math.min(1, 0.5 + tv.y / Math.max(0.01, rad) * 0.8));
    return (dark + (1 - dark) * Math.pow(out, 1.6)) * (0.72 + 0.28 * under);
  };
  const inside = (q: V3, self: Puff) => puffs.some((p) => p !== self && Math.hypot(q.x - p.x, (q.y - p.y) / (p.sy ?? 1), q.z - p.z) < p.r * 0.72);
  // [look12] the twig sprays leave more air between their leaves than the old round clusters: a few more cards
  const cover = (o.cover ?? 2.4) * 1.3;
  const unit = () => { const z = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), rr = Math.sqrt(1 - z * z); return v3(rr * Math.cos(a), z, rr * Math.sin(a)); };
  for (const pf of puffs) {
    const ys = pf.sy ?? 1;
    const area = 4 * Math.PI * pf.r * pf.r * (0.6 + 0.4 * ys);
    const n = Math.max(6, Math.round((area / (o.size * o.size)) * cover));
    const cell = () => o.cells[Math.floor(rng.next() * o.cells.length)];
    // [look12] no round puffs: every clump gets its own lobes (bulges reaching out, mostly sideways and up) and gaps
    // (dents where the cards thin out), so the outline is ragged and asymmetric
    const lobes = Array.from({ length: 3 + Math.floor(rng.next() * 3) }, () => { const d = unit(); d.y = d.y * 0.6 + 0.25; return { d: d.normalize(), a: rng.range(0.14, 0.42) }; });
    const gaps = Array.from({ length: rng.chance(0.6) ? 2 : 1 }, () => unit());
    const reach = (d: V3) => 0.82 + lobes.reduce((acc, l) => acc + l.a * Math.max(0, d.dot(l.d)) ** 3, 0);
    for (let i = 0; i < n; i++) {
      // a point on the puff's skin (a few tucked in deeper), fewer underneath
      const z = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), rr = Math.sqrt(1 - z * z);
      const d = v3(rr * Math.cos(a), z, rr * Math.sin(a));
      if (d.y < -0.4 && rng.chance(0.55)) continue;
      let depth = rng.chance(0.18) ? rng.range(0.45, 0.75) : rng.range(0.78, 1.02);
      if (depth > 0.78 && gaps.some((g) => d.dot(g) > 0.86) && rng.chance(0.6)) continue;
      depth *= reach(d);
      const p = v3(pf.x + d.x * pf.r * depth, pf.y + d.y * pf.r * depth * ys, pf.z + d.z * pf.r * depth);
      if (o.floor !== undefined && p.y < o.floor + o.size * 0.3) p.y = o.floor + o.size * 0.3 + rng.range(0, 0.1);
      if (inside(p, pf)) continue;
      // cards mostly face out of the crown, tipped at random so the edges stay leafy
      const nrm = d.clone().add(v3(rng.range(-0.75, 0.75), rng.range(-0.5, 0.75), rng.range(-0.75, 0.75))).normalize();
      const sz = o.size * rng.range(0.7, 1.3), asp = rng.range(0.85, 1.18);
      const b = rng.range(0.88, 1.1), h = rng.range(-0.05, 0.05);
      leafCard(mb, p, nrm, rng.range(0, Math.PI * 2), sz * asp, sz / asp, leafRect(cell()), c, rad, sy, shade, [b * (1 + h), b, b * (1 - h)], wind, rng.chance(0.5));
    }
    // [look12] sprigs poking out past the clump along its biggest lobes: short chains of smaller cards
    for (const l of lobes) {
      if (l.a < 0.24) continue;
      const k = 2 + Math.floor(rng.next() * 2);
      const dir = l.d.clone().add(v3(rng.range(-0.25, 0.25), rng.range(-0.1, 0.25), rng.range(-0.25, 0.25))).normalize();
      for (let j = 0; j < k; j++) {
        const t = reach(l.d) * (0.95 + (j / k) * 0.4);
        const p = v3(pf.x + dir.x * pf.r * t, pf.y + dir.y * pf.r * t * ys, pf.z + dir.z * pf.r * t);
        if (o.floor !== undefined && p.y < o.floor + o.size * 0.4) break;
        if (inside(p, pf)) continue;
        const nrm = dir.clone().add(v3(rng.range(-0.8, 0.8), rng.range(-0.3, 0.8), rng.range(-0.8, 0.8))).normalize();
        const sz = o.size * rng.range(0.55, 0.8) * (1 - j * 0.12);
        const b = rng.range(0.95, 1.12);
        leafCard(mb, p, nrm, rng.range(0, Math.PI * 2), sz, sz * rng.range(0.9, 1.15), leafRect(cell()), c, rad, sy, shade, [b, b, b], wind, rng.chance(0.5));
      }
    }
    if (o.core !== false) hull(mb, pf, leafRect(o.cells[0]), c, sy, dark * 0.75, [1, 1, 1], wind);
  }
  return mb;
}

export interface ConiferOpts {
  cell: LeafCell; seed: number;
  /** crown base and top (model units), widest radius at the base */
  base: number; top: number; radius: number;
  /** tiers of branches */
  tiers?: number;
  /** card size multiplier */
  size?: number;
  sway?: number;
  /** level of detail: 1 = full, 0.5 = half the cards */
  detail?: number;
  /** the dark inner cone (default on) */
  core?: boolean;
}

/** A fir / spruce / pine crown: drooping tiers of needle sprays radiating from the trunk, plus upright sprays so
 * the tiers read from the side, a leader at the top and a dark inner cone. */
export function conifer(o: ConiferOpts): THREE.BufferGeometry {
  const rng = new Rng(o.seed * 4271 + 5);
  const mb = new MeshBuilder();
  const H = o.top, L = o.top - o.base, tiers = o.tiers ?? Math.max(5, Math.round(L / (o.radius * 0.42)));
  const rect = leafRect(o.cell), sway = (o.sway ?? 0.03) * H, det = o.detail ?? 1;
  const phase = rng.next();
  const axis = v3(0, (o.base + o.top) / 2, 0);
  const sy = Math.max(0.6, L / 2 / o.radius);
  const wind = (q: V3, tip: boolean): [number, number, number, number] => {
    const hk = Math.max(0, Math.min(1, q.y / H));
    return [sway * hk * hk * 1.4, Math.hypot(q.x, q.z) * 0.12, tip ? 0.7 : 0.1, (phase + q.y * 0.21) % 1];
  };
  const shade = (q: V3) => {
    const hk = (q.y - o.base) / L;
    const r = Math.hypot(q.x, q.z) / Math.max(0.01, o.radius * (1 - hk * 0.9));
    return (0.45 + 0.55 * Math.min(1, r)) * (0.82 + 0.25 * hk);
  };
  for (let t = 0; t < tiers; t++) {
    const k = t / tiers, y = o.base + L * k * 0.97;
    const r = o.radius * Math.pow(1 - k, 0.95) + o.radius * 0.12;
    const n = Math.max(4, Math.round((2 * Math.PI * r) / (r * 0.55) * det));
    const a0 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const out = v3(Math.cos(a), 0, Math.sin(a));
      const droop = rng.range(0.25, 0.55);
      const len = r * rng.range(1.0, 1.25) * (o.size ?? 1), wid = len * 1.05;
      const dir = out.clone().multiplyScalar(Math.cos(droop)).addScaledVector(UP, -Math.sin(droop));
      // the card hangs from the trunk: its base edge at the trunk, its tip out and down
      const mid = v3(0, y, 0).addScaledVector(dir, len * 0.5);
      // lie mostly flat, tipped up a little so the top of the tier catches the light
      const tang = v3(-out.z, 0, out.x);
      const nrm = dir.clone().cross(tang).normalize();
      if (nrm.y < 0) nrm.negate();
      nrm.applyAxisAngle(dir, rng.range(-0.5, 0.5));
      const spin = Math.atan2(dir.clone().dot(spinAxisY(nrm)), dir.clone().dot(spinAxisX(nrm))) - Math.PI / 2;
      const b = rng.range(0.9, 1.1);
      leafCard(mb, mid, nrm, spin, wid, len, rect, axis, o.radius, sy, shade, [b, b, b * rng.range(0.96, 1.04)], wind, rng.chance(0.5));
      // an upright spray standing on the branch, so the tier has depth from the side
      if (rng.chance(0.75 * det)) {
        const up = dir.clone().cross(tang).normalize();
        const n2 = tang.clone().applyAxisAngle(dir, rng.range(-0.4, 0.4));
        const m2 = mid.clone().addScaledVector(up.y > 0 ? up : up.negate(), len * 0.12).addScaledVector(dir, len * 0.1);
        const spin2 = Math.atan2(dir.clone().dot(spinAxisY(n2)), dir.clone().dot(spinAxisX(n2))) - Math.PI / 2;
        leafCard(mb, m2, n2, spin2, wid * 0.85, len * 0.85, rect, axis, o.radius, sy, shade, [b * 1.02, b * 1.02, b], wind, rng.chance(0.5));
      }
    }
  }
  // the leader: a few upright sprays round the tip
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const nrm = v3(Math.cos(a), 0.2, Math.sin(a)).normalize();
    const len = o.radius * 0.7;
    leafCard(mb, v3(0, H - len * 0.4, 0), nrm, 0, len * 0.7, len, rect, axis, o.radius, sy, () => 1.05, [1, 1, 1], wind, i % 2 === 0);
  }
  if (o.core !== false) {
    // the dark inner cone
    const segs = 8, rows = 5;
    const ids: number[][] = [];
    const [u0, v0, u1, v1] = rect;
    for (let j = 0; j <= rows; j++) {
      const k = j / rows, y = o.base + L * k * 0.92, r = o.radius * 0.62 * Math.pow(1 - k, 0.95) + 0.02;
      const row: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const q = v3(Math.cos(a) * r, y, Math.sin(a) * r);
        const nn = v3(Math.cos(a), 0.45, Math.sin(a)).normalize();
        const sh = 0.32 + 0.18 * k;
        row.push(mb.vert(q, nn, u0 + (u1 - u0) * (0.35 + 0.3 * (i % 2)), v0 + (v1 - v0) * (0.35 + 0.3 * k), [sh, sh, sh], wind(q, false)));
      }
      ids.push(row);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segs; i++) mb.quad(ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]);
  }
  return mb.build({ moss: false });
}
// the in-plane axes leafCard uses for a normal (so a card's spin can point its +v edge along a direction)
function spinAxisX(n: V3): V3 { const a = Math.abs(n.y) < 0.95 ? UP : new THREE.Vector3(1, 0, 0); return a.clone().cross(n).normalize(); }
function spinAxisY(n: V3): V3 { return n.clone().cross(spinAxisX(n)).normalize(); }

export interface FrondOpts { cell: LeafCell; seed: number; n: number; len: number; width?: number; spread?: number; lift?: [number, number] }
/** A clump of arching cards from one root (ferns, leafy herbs): each card rises at an angle and bends outwards. */
export function fronds(o: FrondOpts): THREE.BufferGeometry {
  const rng = new Rng(o.seed * 131 + 7);
  const mb = new MeshBuilder();
  const rect = leafRect(o.cell);
  const [u0, v0, u1, v1] = rect;
  const phase = rng.next();
  for (let i = 0; i < o.n; i++) {
    const a = (i / o.n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const lift = rng.range(o.lift?.[0] ?? 0.45, o.lift?.[1] ?? 1.05);
    const L = o.len * rng.range(0.75, 1.1), w = L * (o.width ?? 0.42);
    const out = v3(Math.cos(a), 0, Math.sin(a)), side = v3(-out.z, 0, out.x);
    const root = v3(rng.range(-1, 1) * (o.spread ?? 0.05), 0, rng.range(-1, 1) * (o.spread ?? 0.05));
    // three segments arching over
    const segs = 3;
    let prev: [number, number] | null = null;
    const b = rng.range(0.88, 1.1);
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, el = lift - t * t * 1.2;
      const p = root.clone().addScaledVector(out, Math.cos(lift * 0.5 + t * 0.6) * L * t).addScaledVector(UP, Math.sin(el * 0.9 + 0.2) * L * t * 0.8);
      const nrm = UP.clone().multiplyScalar(0.8).addScaledVector(out, 0.5).normalize();
      const k = (0.55 + 0.45 * t) * b;
      const wn: [number, number, number, number] = [0, p.y * 0.3, t, phase + i * 0.07];
      const vv = v0 + (v1 - v0) * t;
      const ia = mb.vert(p.clone().addScaledVector(side, -w * 0.5 * (1 - t * 0.3)), nrm, u0, vv, [k, k, k], wn);
      const ib = mb.vert(p.clone().addScaledVector(side, w * 0.5 * (1 - t * 0.3)), nrm, u1, vv, [k, k, k], wn);
      if (prev) mb.quad(prev[0], prev[1], ib, ia);
      prev = [ia, ib];
    }
  }
  return mb.build({ moss: false });
}

/** Cluster points (e.g. leaf positions from a tree skeleton) into puffs on a grid of `cell` (model units). */
export function puffsFromPoints(points: V3[], o: { cell: number; grow?: number; max?: number; minR?: number }): Puff[] {
  const bins = new Map<string, V3[]>();
  for (const p of points) {
    const k = `${Math.floor(p.x / o.cell)},${Math.floor(p.y / o.cell)},${Math.floor(p.z / o.cell)}`;
    let b = bins.get(k);
    if (!b) bins.set(k, (b = []));
    b.push(p);
  }
  let puffs: (Puff & { n: number })[] = [];
  for (const list of bins.values()) {
    const c = v3();
    for (const p of list) c.add(p);
    c.multiplyScalar(1 / list.length);
    let spread = 0;
    for (const p of list) spread = Math.max(spread, p.distanceTo(c));
    puffs.push({ x: c.x, y: c.y, z: c.z, r: Math.max(o.minR ?? o.cell * 0.45, Math.min(o.cell * 0.95, spread * 0.8 + o.cell * 0.35)) * (o.grow ?? 1), n: list.length });
  }
  puffs.sort((a, b) => b.n - a.n);
  if (o.max && puffs.length > o.max) puffs = puffs.slice(0, o.max);
  return puffs.map(({ n: _n, ...p }) => p);
}
