// A tiny mesh builder for the hollow oak: parametric grids (the bark, the cut lips, ceilings), sweeps along outlines
// (window and door frames, tunnels through the wall), tubes (roots, limbs, pipes) and merged three.js primitives,
// all in house px with a vertex colour per vertex (ambient occlusion, or masks the bark shader reads).
import * as THREE from 'three';

export type V3 = [number, number, number];
export type UV = [number, number];

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

export class Geo {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  /** explicit normals (when every vertex has one; otherwise they are computed) */
  nor: number[] = [];

  get count() { return this.pos.length / 3; }

  vert(p: V3, uv: UV, c: V3 = [1, 1, 1], n?: V3): number {
    this.pos.push(p[0], p[1], p[2]);
    this.uv.push(uv[0], uv[1]);
    this.col.push(c[0], c[1], c[2]);
    if (n) this.nor.push(n[0], n[1], n[2]);
    return this.count - 1;
  }

  tri(a: number, b: number, c: number) { this.idx.push(a, b, c); }
  /** a-b-c-d counter-clockwise seen from the front */
  quad(a: number, b: number, c: number, d: number) { this.idx.push(a, b, c, a, c, d); }

  /**
   * A parametric surface: nu x nv cells; f(u, v) gives each vertex (u, v in 0..1). `skip` drops cells (holes).
   * Faces wind so that d/du x d/dv points out (flip to turn them round).
   */
  grid(nu: number, nv: number, f: (u: number, v: number, i: number, j: number) => { p: V3; uv: UV; c?: V3; n?: V3 }, o: { skip?: (u0: number, u1: number, v0: number, v1: number) => boolean; flip?: boolean; us?: number[]; vs?: number[] } = {}) {
    const us = o.us ?? Array.from({ length: nu + 1 }, (_, i) => i / nu);
    const vs = o.vs ?? Array.from({ length: nv + 1 }, (_, j) => j / nv);
    const base = this.count, W = us.length;
    for (let j = 0; j < vs.length; j++) for (let i = 0; i < W; i++) { const r = f(us[i], vs[j], i, j); this.vert(r.p, r.uv, r.c, r.n); }
    for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < W - 1; i++) {
      if (o.skip?.(us[i], us[i + 1], vs[j], vs[j + 1])) continue;
      const a = base + j * W + i, b = a + 1, c = a + W + 1, d = a + W;
      if (o.flip) this.quad(a, d, c, b); else this.quad(a, b, c, d);
    }
  }

  /** Merge a three.js geometry, transformed by m, with one colour (or a colour per vertex from fc). */
  add(g: THREE.BufferGeometry, m?: THREE.Matrix4, c: V3 = [1, 1, 1], fc?: (p: THREE.Vector3) => V3) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const base = this.count;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      if (m) _v.applyMatrix4(m);
      this.vert([_v.x, _v.y, _v.z], uv ? [uv.getX(i), uv.getY(i)] : [0, 0], fc ? fc(_v) : c);
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    g.dispose();
  }

  /**
   * A tube along a path (points with a radius each), `sides` round, uv u around (0..uRep) and v along the length
   * in house px / vScale. `twist` turns the frame along the way. Ends are left open (bury them or cap them).
   */
  tube(path: V3[], radius: number[], sides: number, o: { uRep?: number; vScale?: number; col?: (t: number, around: number, n: THREE.Vector3, p: THREE.Vector3) => V3; capEnd?: boolean; squash?: number } = {}) {
    const n = path.length;
    const T: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = new THREE.Vector3(...path[Math.max(0, i - 1)]), b = new THREE.Vector3(...path[Math.min(n - 1, i + 1)]);
      T.push(b.sub(a).normalize());
    }
    // parallel-transport a frame along the path
    let N = new THREE.Vector3(0, 1, 0);
    if (Math.abs(N.dot(T[0])) > 0.9) N.set(1, 0, 0);
    N = N.sub(T[0].clone().multiplyScalar(N.dot(T[0]))).normalize();
    const frames: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < n; i++) {
      if (i > 0) { N = N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize(); }
      frames.push([N.clone(), new THREE.Vector3().crossVectors(T[i], N).normalize()]);
    }
    const uRep = o.uRep ?? 1, vScale = o.vScale ?? 64;
    let len = 0;
    const base = this.count;
    for (let i = 0; i < n; i++) {
      if (i > 0) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
      const [Ni, Bi] = frames[i];
      for (let k = 0; k <= sides; k++) {
        const th = (k / sides) * Math.PI * 2;
        _n.copy(Ni).multiplyScalar(Math.cos(th)).addScaledVector(Bi, Math.sin(th) * (o.squash ?? 1));
        const r = radius[i];
        _v.set(path[i][0], path[i][1], path[i][2]).addScaledVector(_n, r);
        this.vert([_v.x, _v.y, _v.z], [(k / sides) * uRep, len / vScale], o.col ? o.col(i / (n - 1), k / sides, _n.clone().normalize(), _v.clone()) : [1, 1, 1]);
      }
    }
    const W = sides + 1;
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
      const a = base + i * W + k;
      this.quad(a, a + 1, a + W + 1, a + W);
    }
    if (o.capEnd) {
      const c = this.vert(path[n - 1], [0.5, len / vScale], o.col ? o.col(1, 0, T[n - 1], new THREE.Vector3(...path[n - 1])) : [1, 1, 1]);
      for (let k = 0; k < sides; k++) { const a = base + (n - 1) * W + k; this.tri(a, a + 1, c); }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    if (this.nor.length === this.pos.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    else g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** A matrix from a position (px), Euler rotation (rad, YXZ so yaw comes first) and scale. */
export function mat(p: V3, r: V3 = [0, 0, 0], s: V3 | number = 1): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ'));
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  return new THREE.Matrix4().compose(new THREE.Vector3(...p), q, sc);
}

/** Catmull-Rom through control points, n samples. */
export function spline(pts: V3[], n: number): V3[] {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  return c.getPoints(n - 1).map((v) => [v.x, v.y, v.z] as V3);
}
