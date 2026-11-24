// [look4] The small life of the glade as properly shaped models (no boxes, spheres or cylinders): koi with a lofted
// plump body, dorsal and pectoral fins and a forked tail; dragonflies with a thorax, big compound eyes and a long
// segmented abdomen under four veined glass wings; butterflies with a furry body, antennae and hand-pixelled wings.
// Every part is one InstancedMesh for all the animals of a kind (a handful of draw calls in all): the critter logic
// moves invisible proxy nodes and sync() copies their world matrices into the instances.
import * as THREE from 'three';

type V = THREE.Vector3;
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A lofted body along +z: rings of an ellipse whose half-width and half-height follow profile(t), t 0 tail .. 1 nose. */
function loft(len: number, rings: number, sides: number, profile: (t: number) => [number, number, number], colour: (t: number, a: number) => [number, number, number], extra?: (t: number, a: number) => number): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], ext: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, [w, h, yOff] = profile(t), z = (t - 0.5) * len;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const x = Math.cos(a) * w, y = Math.sin(a) * h + yOff;
      pos.push(x, y, z);
      const n = v(Math.cos(a) * h, Math.sin(a) * w, 0).normalize();
      nrm.push(n.x, n.y, n.z);
      col.push(...colour(t, a));
      ext.push(extra ? extra(t, a) : 0);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPatch', new THREE.Float32BufferAttribute(ext, 1));
  g.setIndex(idx);
  return g;
}

/** A flat fin or wing from an outline (x, z in the plane y = 0), triangulated as a fan from its first point. */
function flat(outline: [number, number][], colour: [number, number, number], uvBox?: [number, number, number, number]): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
  const [x0, z0, x1, z1] = uvBox ?? [0, 0, 1, 1];
  for (const [x, z] of outline) { pos.push(x, 0, z); col.push(...colour); uv.push((x - x0) / (x1 - x0), (z - z0) / (z1 - z0)); }
  for (let i = 1; i < outline.length - 1; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(outline.flatMap(() => [0, 1, 0]), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aPatch', new THREE.Float32BufferAttribute(outline.map(() => 0), 1));
  g.setIndex(idx);
  return g;
}
const curve = (pts: [number, number][], n = 6): [number, number][] => {
  // a smooth closed outline through the control points (Catmull-Rom)
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => v(x, 0, z)), true, 'centripetal');
  return c.getPoints(pts.length * n).slice(0, -1).map((p) => [p.x, p.z] as [number, number]);
};
function merge(parts: THREE.BufferGeometry[], xf: THREE.Matrix4[]): THREE.BufferGeometry {
  const out: THREE.BufferGeometry[] = parts.map((g, i) => { const c = g.clone(); c.applyMatrix4(xf[i]); if (!c.getAttribute('uv')) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.getAttribute('position').count * 2), 2)); return c; });
  let n = 0; const idx: number[] = [];
  const attrs: Record<string, number[]> = { position: [], normal: [], color: [], uv: [], aPatch: [] };
  for (const g of out) {
    for (const k of Object.keys(attrs)) attrs[k].push(...(g.getAttribute(k).array as Float32Array));
    for (const i of g.index!.array) idx.push(i + n);
    n += g.getAttribute('position').count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(attrs.position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(attrs.normal, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(attrs.color, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(attrs.uv, 2));
  g.setAttribute('aPatch', new THREE.Float32BufferAttribute(attrs.aPatch, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
const M = (p: V, r: THREE.Euler = new THREE.Euler(), s: V = v(1, 1, 1)) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(r), s);
const hashf = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- koi

/** Koi body with fins (origin at the body's middle, nose towards +z, about 0.3 long); aPatch marks the patches. */
export function koiBody(): THREE.BufferGeometry {
  const body = loft(0.3, 14, 10, (t) => {
    // plump in front, tapering to a slim tail stem; a slightly flattened belly
    const w = 0.038 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.95)), 0.75) * (t < 0.2 ? 0.55 + t * 2.25 : 1) + 0.006;
    return [w, w * 1.08, (t - 0.5) * 0.004];
  }, (t, a) => {
    const belly = Math.sin(a) < -0.3 ? 1.08 : 1;
    const head = t > 0.86 ? 0.94 : 1;
    return [belly * head, belly * head, belly * head];
  }, (t, a) => {
    // irregular patches on the back (kohaku-style), never on the belly
    const top = Math.sin(a);
    const n = hashf(Math.floor(t * 7), Math.floor((a + 7) * 1.3)) * 0.6 + hashf(Math.floor(t * 3.5) + 9, 1) * 0.4;
    return top > -0.1 && n > 0.48 && t > 0.15 ? 1 : 0;
  });
  const fin: [number, number, number] = [1.02, 1.02, 1.02];
  const dorsal = flat(curve([[0, 0], [0.025, 0.02], [0.03, 0.07], [0.012, 0.11], [0, 0.1]]), fin);
  const pect = flat(curve([[0, 0], [0.03, -0.012], [0.042, -0.03], [0.02, -0.034], [0.004, -0.012]]), fin);
  return merge([body, dorsal, pect, pect], [
    M(v(0, 0, 0)),
    M(v(0, 0.034, -0.06), new THREE.Euler(0, 0, Math.PI / 2)),
    M(v(0.03, -0.018, 0.07), new THREE.Euler(0.3, 0.3, -0.5)),
    M(v(-0.03, -0.018, 0.07), new THREE.Euler(0.3, -0.3, 0.5), v(-1, 1, 1)),
  ]);
}
/** The forked tail fin (origin at the tail stem, trailing along -z). */
export function koiTail(): THREE.BufferGeometry {
  const t = flat(curve([[0, 0.01], [0.022, -0.02], [0.05, -0.075], [0.028, -0.07], [0, -0.045], [-0.028, -0.07], [-0.05, -0.075], [-0.022, -0.02]]), [1.04, 1.04, 1.04]);
  return merge([t], [M(v(0, 0, 0), new THREE.Euler(0, 0, Math.PI / 2))]);
}

/** Koi material: instance colour for the body, a per-instance patch colour (iPatch) where aPatch is set, a soft sheen. */
export function koiMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPatch;\nattribute vec3 iPatch;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvColor.rgb = mix(instanceColor.rgb, iPatch, aPatch) * color.rgb;\n#endif');
  };
  m.customProgramCacheKey = () => 'hh-koi';
  return m;
}

// ---------------------------------------------------------------- dragonfly

/** Dragonfly body: head with big compound eyes, thorax, a long segmented abdomen (nose towards +z, ~0.3 long). */
export function dragonflyBody(): THREE.BufferGeometry {
  const blue: [number, number, number] = [0.16, 0.42, 0.52], dark: [number, number, number] = [0.06, 0.12, 0.16];
  const abdomen = loft(0.22, 22, 6, (t) => {
    const seg = 0.85 + 0.15 * Math.abs(Math.sin(t * Math.PI * 8));
    const w = (0.006 + 0.006 * t + (t > 0.93 ? -0.004 : 0)) * seg;
    return [w, w, 0];
  }, (t) => (Math.sin(t * Math.PI * 8) > 0.75 ? dark : blue));
  const thorax = loft(0.06, 6, 8, (t) => { const w = 0.012 * Math.sin(Math.PI * (0.15 + t * 0.75)) + 0.003; return [w, w * 1.15, 0.002]; }, () => [0.2, 0.36, 0.3]);
  const eye = loft(0.022, 6, 8, (t) => { const w = 0.011 * Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) + 0.001; return [w, w, 0]; }, () => [0.22, 0.55, 0.42]);
  return merge([abdomen, thorax, eye, eye], [
    M(v(0, 0, -0.12)), M(v(0, 0.002, 0.02)),
    M(v(0.008, 0.006, 0.058), new THREE.Euler(0, 0.5, 0)), M(v(-0.008, 0.006, 0.058), new THREE.Euler(0, -0.5, 0)),
  ]);
}
/** One side's pair of glass wings (fore and hind), spreading along +x from the thorax. */
export function dragonflyWings(): THREE.BufferGeometry {
  const fore = flat(curve([[0, 0], [0.06, 0.012], [0.15, 0.012], [0.17, -0.002], [0.12, -0.014], [0.03, -0.01]]), [1, 1, 1], [0, -0.02, 0.17, 0.02]);
  const hind = flat(curve([[0, 0], [0.05, 0.004], [0.14, -0.002], [0.155, -0.016], [0.09, -0.028], [0.02, -0.016]]), [1, 1, 1], [0, -0.03, 0.16, 0.01]);
  return merge([fore, hind], [M(v(0, 0, 0.026)), M(v(0, 0, -0.004))]);
}
let wingTex: THREE.DataTexture | null = null;
/** Glassy wing membrane: a pale blue-green tint, dark veins, a dark pterostigma near the tip. */
export function dragonflyWingMaterial(): THREE.MeshStandardMaterial {
  if (!wingTex) {
    const W = 64, H = 16, d = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      const vein = y % 4 === 0 || x % 7 === 0 || (x + y * 2) % 11 === 0;
      const stigma = x > 52 && x < 57 && y > 7 && y < 11;
      const c = stigma ? [40, 46, 52, 235] : vein ? [70, 90, 96, 200] : [210, 236, 236, 70];
      d.set(c, k);
    }
    wingTex = new THREE.DataTexture(d, W, H);
    wingTex.magFilter = THREE.NearestFilter; wingTex.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({ map: wingTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1, vertexColors: true });
}

// ---------------------------------------------------------------- butterfly

/** Butterfly body: a furry tapering abdomen, thorax, head and two clubbed antennae (nose +z, ~0.09 long). */
export function butterflyBody(): THREE.BufferGeometry {
  const ink: [number, number, number] = [0.24, 0.2, 0.17];
  const abdomen = loft(0.06, 8, 6, (t) => { const w = 0.006 * Math.sin(Math.PI * (0.1 + t * 0.85)) + 0.002; return [w, w, 0]; }, (t) => (Math.floor(t * 8) % 2 ? ink : [0.36, 0.3, 0.24]));
  const thorax = loft(0.025, 5, 6, (t) => { const w = 0.0075 * Math.sin(Math.PI * (0.1 + t * 0.8)) + 0.002; return [w, w * 1.1, 0]; }, () => [0.42, 0.36, 0.28]);
  const antenna = loft(0.04, 4, 3, (t) => { const w = t > 0.85 ? 0.0022 : 0.0008; return [w, w, 0]; }, () => ink);
  return merge([abdomen, thorax, antenna, antenna], [
    M(v(0, 0, -0.03)), M(v(0, 0.001, 0.012)),
    M(v(0.006, 0.01, 0.04), new THREE.Euler(-0.7, 0.35, 0)), M(v(-0.006, 0.01, 0.04), new THREE.Euler(-0.7, -0.35, 0)),
  ]);
}
/** One wing (fore and hind as one painted card), spreading along +x. */
export function butterflyWing(): THREE.BufferGeometry {
  const w = flat([[0, -0.045], [0.1, -0.045], [0.1, 0.055], [0, 0.055]], [1, 1, 1], [0, -0.045, 0.1, 0.055]);
  w.setIndex([0, 1, 2, 0, 2, 3]);
  return w;
}
let bwTex: THREE.DataTexture | null = null;
/** Hand-pixelled wings: a rounded forewing and smaller hindwing, a dark border with pale dots, an eye-spot; the
 * colour comes from the instance colour (the dark and pale parts stay dark and pale). */
export function butterflyWingMaterial(): THREE.MeshStandardMaterial {
  if (!bwTex) {
    const W = 32, H = 32, d = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, vv = (y + 0.5) / H, k = (y * W + x) * 4;
      const f = ((u - 0.05) / 0.98) ** 2 + ((vv - 0.68) / 0.36) ** 2, h = ((u - 0.02) / 0.74) ** 2 + ((vv - 0.27) / 0.3) ** 2;
      const fore = f < 1 && vv > 0.36, hind = h < 1;
      if (!fore && !hind) { d.set([0, 0, 0, 0], k); continue; }
      const edge = fore ? f > 0.62 : h > 0.56;
      let c: number[];
      if (edge) c = (x + y * 3) % 5 === 0 ? [250, 246, 236] : [40, 34, 30];
      else if (fore && Math.abs(u - 0.6) < 0.08 && Math.abs(vv - 0.72) < 0.06) c = [255, 252, 240];
      else if (hind && Math.abs(u - 0.42) < 0.07 && Math.abs(vv - 0.25) < 0.05) c = [60, 50, 60];
      else { const g = 200 + (u < 0.18 ? -60 : 0) + Math.round((1 - u) * 40); c = [g, g, g]; }
      d.set([...c, 255], k);
    }
    bwTex = new THREE.DataTexture(d, W, H);
    bwTex.magFilter = THREE.NearestFilter; bwTex.colorSpace = THREE.SRGBColorSpace; bwTex.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({ map: bwTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
}

// ---------------------------------------------------------------- instancing

/** One InstancedMesh fed from proxy nodes every frame (hidden proxies collapse to a zero scale). */
export class Swarm {
  readonly mesh: THREE.InstancedMesh;
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, readonly nodes: THREE.Object3D[], name: string) {
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, nodes.length));
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = nodes.length;
  }
  sync() {
    this.nodes.forEach((n, i) => {
      let vis = true;
      for (let o: THREE.Object3D | null = n; o; o = o.parent) if (!o.visible) { vis = false; break; }
      this.mesh.setMatrixAt(i, vis ? n.matrixWorld : this.zero);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
