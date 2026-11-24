// Geometry helpers for the office: boxes with soft bevels and world-scaled texture coordinates (so every
// surface has the same texel density, ~256 texels per metre), turned (lathe) parts, merging by material,
// and a tiny material cache.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** texture repeats per metre for tiling material textures (a 512 px texture at 256 px/m covers 2 m) */
export const TEX_M = 0.5;

/** Box-project UVs from positions (u, v in metres x `k`), picking the plane of each vertex's normal. Grain along `along`. */
export function boxUV(g: THREE.BufferGeometry, k = TEX_M, along: 'x' | 'y' | 'z' = 'x', off = new THREE.Vector2()) {
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ax >= ay && ax >= az) { u = z; v = y; if (along === 'z') { /* grain along z: u = z */ } else if (along === 'y') { u = y; v = z; } }
    else if (ay >= ax && ay >= az) { u = x; v = z; if (along === 'z') { u = z; v = x; } }
    else { u = x; v = y; if (along === 'y') { u = y; v = x; } }
    uv[i * 2] = u * k + off.x; uv[i * 2 + 1] = v * k + off.y;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** A box (w x h x d metres) with its base at y = 0 by default, bevelled edges and world-scaled UVs. */
export function bbox(w: number, h: number, d: number, o: { r?: number; along?: 'x' | 'y' | 'z'; k?: number; center?: boolean; off?: THREE.Vector2 } = {}): THREE.BufferGeometry {
  const r = Math.min(o.r ?? 0.006, w / 2.01, h / 2.01, d / 2.01);
  const g: THREE.BufferGeometry = r > 0.0005 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d);
  if (!o.center) g.translate(0, h / 2, 0);
  const along = o.along ?? (w >= d && w >= h ? 'x' : d >= h ? 'z' : 'y');
  boxUV(g, o.k ?? TEX_M, along, o.off ?? new THREE.Vector2(Math.random() * 7, Math.random() * 7));
  return g;
}

/** A box whose six faces map to the whole texture (0..1): signs, plates, book blocks. */
export function cardBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

/** Turned part: a profile of [radius, y] points revolved round Y. */
export function lathe(pts: [number, number][], seg = 24, o: { k?: number } = {}): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg);
  if (o.k) { const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.k, uv.getY(i)); }
  return g;
}

export function cyl(r: number, h: number, seg = 16, o: { r2?: number; open?: boolean } = {}) {
  const g = new THREE.CylinderGeometry(o.r2 ?? r, r, h, seg, 1, o.open);
  g.translate(0, h / 2, 0);
  return g;
}

/** Place a geometry: translate, rotate (Euler xyz), returns it. */
export function at(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  g.applyMatrix4(m);
  return g;
}

/** Collect geometries per material; `build()` merges each into one mesh (one draw call per material). */
export class Batch {
  private by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, ...gs: THREE.BufferGeometry[]) {
    let l = this.by.get(mat);
    if (!l) this.by.set(mat, (l = []));
    for (const g of gs) l.push(g.index ? g.toNonIndexed() : g);
    return this;
  }
  build(name = 'batch', o: { cast?: boolean; receive?: boolean } = {}): THREE.Group {
    const grp = new THREE.Group();
    grp.name = name;
    for (const [mat, list] of this.by) {
      for (const g of list) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
      grp.add(m);
    }
    this.by.clear();
    return grp;
  }
}

/** Standard material helper. */
export function mat(o: THREE.MeshStandardMaterialParameters & { name?: string }): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });
}
