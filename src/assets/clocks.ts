// Live clock faces: every clock in the game shows the real time. The painted enamel dials (numerals, minute track,
// bezel: art/lowpix/items/retex.py) carry no hands; here a set of real 3D hands (blued-steel spade hour and minute
// hands, a red seconds hand with a counterweight, a brass boss) is mounted on each dial and turned to the time
// every frame. The dial is found from the texture: the triangles whose uvs fall inside the painted dial circle give
// its centre, size and facing, so the hands sit exactly on it whatever the model's units or pose.
import * as THREE from 'three';

interface ClockSpec {
  /** the dial in the item's atlas: atlas size (px), centre (px from the top left) and radius (px) */
  atlas: [number, number];
  c: [number, number];
  r: number;
  /** nodes of old modelled hands to hide */
  hide?: string[];
  /** strip old hands built into the static mesh (triangles standing just proud of the dial) */
  strip?: boolean;
  /** how far out from the centre the face's numerals reach (fraction of r) */
  face?: number;
}

const CLOCKS: Record<string, ClockSpec> = {
  mantel_clock: { atlas: [512, 512], c: [235, 118], r: 33, face: 0.84 },
  cuckoo: { atlas: [512, 1024], c: [53, 223.5], r: 45, hide: ['hourh', 'minh', 'hub'], face: 0.92 },
  chalet_cuckoo: { atlas: [512, 1024], c: [44.5, 190.5], r: 33, strip: true, face: 0.92 },
};

export const isClock = (id: string) => id in CLOCKS;
/** dev: where the dial was found */
export const _dialOf = (root: THREE.Object3D, id: string) => (CLOCKS[id] ? findDial(root, CLOCKS[id]) : null);

const steel = new THREE.MeshStandardMaterial({ color: 0x1c2234, metalness: 0.55, roughness: 0.32 });
const red = new THREE.MeshStandardMaterial({ color: 0xa8322a, metalness: 0.3, roughness: 0.4 });
const brass = new THREE.MeshStandardMaterial({ color: 0xd2a352, metalness: 0.6, roughness: 0.3 });

/** A clock hand pointing up +Y from the pivot (units: dial radius 1): a slim shaft ending in a spade or a point. */
function handShape(len: number, w: number, kind: 'hour' | 'minute' | 'second'): THREE.Shape {
  const s = new THREE.Shape();
  if (kind === 'second') {
    s.moveTo(-w, -len * 0.26); s.lineTo(w, -len * 0.26); s.lineTo(w * 0.6, len); s.lineTo(-w * 0.6, len); s.closePath();
    return s;
  }
  const tail = len * 0.16, sp = kind === 'hour' ? 0.62 : 0.74;
  s.moveTo(-w, -tail);
  s.lineTo(w, -tail);
  s.lineTo(w * 0.7, len * sp);
  // the spade: a rounded leaf near the tip
  s.quadraticCurveTo(w * 3.2, len * (sp + 0.06), w * 0.25, len * 0.97);
  s.lineTo(0, len);
  s.lineTo(-w * 0.25, len * 0.97);
  s.quadraticCurveTo(-w * 3.2, len * (sp + 0.06), -w * 0.7, len * sp);
  s.closePath();
  return s;
}

function hand(len: number, w: number, kind: 'hour' | 'minute' | 'second', depth: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(handShape(len, w, kind), { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: w * 0.15, bevelSegments: 1, curveSegments: 6 });
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  if (kind === 'second') {
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(w * 3, w * 3, depth, 10), mat);
    cw.rotation.x = Math.PI / 2;
    cw.position.set(0, -len * 0.2, depth / 2);
    m.add(cw);
  }
  return m;
}

/** Find the painted dial on the model: centre, in-plane axes per atlas px, and the outward normal (root space). */
function findDial(root: THREE.Object3D, sp: ClockSpec) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rows: [number, number, THREE.Vector3][] = [];
  const meshes: THREE.Mesh[] = [];
  const [W, H] = sp.atlas;
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const map = (m.material as THREE.MeshStandardMaterial).map;
    const img = map?.image as { width?: number } | undefined;
    if (!img?.width || img.width < 256) return;
    meshes.push(m);
    const g = m.geometry, pos = g.getAttribute('position'), uv = g.getAttribute('uv');
    if (!pos || !uv) return;
    const M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const idx = g.getIndex();
    const tri = idx ? idx.count / 3 : pos.count / 3;
    const at = (k: number) => (idx ? idx.getX(k) : k);
    for (let t = 0; t < tri; t++) {
      const vs = [at(t * 3), at(t * 3 + 1), at(t * 3 + 2)];
      // a dial face triangle: all its corners near the painted circle (rim vertices may sit a little outside it) with
      // its centre inside, or a big card the whole dial is painted on (the circle's centre lies in it)
      const q = vs.map((v) => [uv.getX(v) * W - sp.c[0], uv.getY(v) * H - sp.c[1]] as const);
      const near = q.every(([x, y]) => Math.hypot(x, y) < sp.r * 1.35) && Math.hypot((q[0][0] + q[1][0] + q[2][0]) / 3, (q[0][1] + q[1][1] + q[2][1]) / 3) < sp.r;
      const side = (a: readonly [number, number], b: readonly [number, number]) => a[0] * b[1] - a[1] * b[0];
      const s0 = side(q[0], q[1]), s1 = side(q[1], q[2]), s2 = side(q[2], q[0]);
      const covers = (s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0);
      if (!near && !covers) continue;
      for (const v of vs) rows.push([uv.getX(v) * W - sp.c[0], uv.getY(v) * H - sp.c[1], new THREE.Vector3().fromBufferAttribute(pos, v).applyMatrix4(M)]);
    }
  });
  if (rows.length < 3) return null;
  // least squares: p = P0 + Au du + Av dv
  const A = new THREE.Matrix3(), n = rows.length;
  let s1 = 0, su = 0, sv = 0, suu = 0, suv = 0, svv = 0;
  const b0 = new THREE.Vector3(), bu = new THREE.Vector3(), bv = new THREE.Vector3();
  for (const [du, dv, p] of rows) {
    s1++; su += du; sv += dv; suu += du * du; suv += du * dv; svv += dv * dv;
    b0.add(p); bu.addScaledVector(p, du); bv.addScaledVector(p, dv);
  }
  A.set(s1, su, sv, su, suu, suv, sv, suv, svv);
  if (Math.abs(A.determinant()) < 1e-9) return null;
  A.invert();
  const e = A.elements; // column-major
  const solve = (c: 0 | 1 | 2, k: 'x' | 'y' | 'z') => e[c] * b0[k] + e[c + 3] * bu[k] + e[c + 6] * bv[k];
  const P0 = new THREE.Vector3(solve(0, 'x'), solve(0, 'y'), solve(0, 'z'));
  const Au = new THREE.Vector3(solve(1, 'x'), solve(1, 'y'), solve(1, 'z'));
  const Av = new THREE.Vector3(solve(2, 'x'), solve(2, 'y'), solve(2, 'z'));
  void n;
  const out = new THREE.Vector3().crossVectors(Av, Au).normalize();
  return { P0, Au, Av, out, meshes };
}

/** Remove old hands modelled into a static mesh: triangles over the dial's middle, standing a little proud of it. */
function stripHands(meshes: THREE.Mesh[], root: THREE.Object3D, P0: THREE.Vector3, out: THREE.Vector3, R: number) {
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const m of meshes) {
    const g = m.geometry;
    if (g.userData.handsStripped) continue;
    const idx = g.getIndex(), pos = g.getAttribute('position');
    if (!idx || !pos) continue;
    const M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const keep: number[] = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(M); b.fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(M); c.fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(M);
      const cen = a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(P0);
      const h = cen.dot(out), radial = cen.clone().addScaledVector(out, -h).length();
      const hands = h > R * 0.015 && h < R * 0.5 && radial < R * 0.8;
      if (!hands) keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    }
    g.setIndex(keep);
    g.userData.handsStripped = true;
  }
}

/** Mount live hands on a clock item's model (root space). Returns a tick(date) to turn them, or null. */
export function liveClock(root: THREE.Object3D, id: string): ((d: Date) => void) | null {
  const sp = CLOCKS[id];
  if (!sp) return null;
  const dial = findDial(root, sp);
  if (!dial) return null;
  const { P0, Au, Av, out, meshes } = dial;
  for (const nm of sp.hide ?? []) { const o = root.getObjectByName(nm); if (o) o.visible = false; }
  const R = Au.length() * sp.r * (sp.face ?? 0.9);
  if (sp.strip) stripHands(meshes, root, P0, out, R);
  const X = Au.clone().normalize(), Y = Av.clone().normalize().negate(), Z = out;
  const basis = new THREE.Matrix4().makeBasis(X, Y, Z);
  const g = new THREE.Group();
  g.name = 'clockhands';
  g.quaternion.setFromRotationMatrix(basis);
  g.position.copy(P0).addScaledVector(Z, R * 0.012);
  g.scale.setScalar(R);
  const d = 0.018;
  const hr = hand(0.52, 0.035, 'hour', d, steel), mn = hand(0.8, 0.026, 'minute', d, steel), sc = hand(0.86, 0.008, 'second', d * 0.6, red);
  hr.position.z = 0; mn.position.z = d * 1.6; sc.position.z = d * 3.2;
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, d * 2, 12), brass);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = d * 4.2;
  g.add(hr, mn, sc, boss);
  root.add(g);
  return (now: Date) => {
    const s = now.getSeconds(), m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
    hr.rotation.z = -(h / 12) * Math.PI * 2;
    mn.rotation.z = -(m / 60) * Math.PI * 2;
    sc.rotation.z = -(s / 60) * Math.PI * 2;
  };
}
