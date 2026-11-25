// The lodge store's building kit: peeled logs, stick lattices, gnawed stumps, wooden barrels with brass hoops, burlap
// acorn sacks heaped with acorns, gem chests full of glowing moon gems, brass scales, a wrapped parcel, a chalk slate,
// cloth banners, carved hanging signs and curls of wood shavings. Geometry is built here (lathes, tubes, boxes) and
// dressed in the shop's hand-painted pixel textures (public/models/shop/tex, from BUSHED's CC0 photo-based set) and
// in pixel canvases painted in code. Real light does the shading. OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { modelUrl } from '../../gfx/glb.ts';
import { rng } from '../../gfx/noise.ts';
import { alagard, alagardReady, alagardSafe, alagardText } from '../../ui/font.ts';
import { drawText3D, fitText3D } from '../../ui/text3d.tsx';

// ------------------------------------------------------------------ textures and materials

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
/** A shop texture: nearest magnification (crisp texels), mipmapped minification, repeating. */
export function tex(name: string, srgb = true): THREE.Texture {
  const key = name + (srgb ? '' : ':lin');
  let t = texCache.get(key);
  if (!t) {
    t = loader.load(modelUrl(`shop/tex/${name}.webp`));
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 8;
    texCache.set(key, t);
  }
  return t;
}
export function disposeTextures() { for (const t of texCache.values()) t.dispose(); texCache.clear(); }

const mats = new Map<string, THREE.Material>();
export function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = mats.get(key);
  if (!m) { m = make(); mats.set(key, m); }
  return m;
}
export function disposeMats() { for (const m of mats.values()) m.dispose(); mats.clear(); }

export const M = {
  log: () => mat('log', () => new THREE.MeshStandardMaterial({ map: tex('log'), color: 0xe4ddd2, vertexColors: true, normalMap: tex('log_n', false), normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.86 })),
  end: () => mat('end', () => new THREE.MeshStandardMaterial({ map: tex('end'), roughness: 0.9 })),
  bark: () => mat('bark', () => new THREE.MeshStandardMaterial({ map: tex('bark'), normalMap: tex('bark_n', false), normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.95 })),
  /** bark for logGeo sticks (tinted per stick) */
  barkLog: () => mat('barkLog', () => new THREE.MeshStandardMaterial({ map: tex('bark'), vertexColors: true, normalMap: tex('bark_n', false), normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.95 })),
  chink: () => mat('chink', () => new THREE.MeshStandardMaterial({ map: tex('chink'), roughness: 1 })),
  floor: () => mat('floor', () => new THREE.MeshStandardMaterial({ map: tex('floor'), normalMap: tex('floor_n', false), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.82 })),
  board: () => mat('board', () => new THREE.MeshStandardMaterial({ map: tex('board'), roughness: 0.78 })),
  boardDark: () => mat('boardDark', () => new THREE.MeshStandardMaterial({ map: tex('board'), color: 0x9a7a62, roughness: 0.8 })),
  burlap: () => mat('burlap', () => new THREE.MeshStandardMaterial({ map: tex('burlap'), color: 0xfff4e2, roughness: 1 })),
  brass: () => mat('brass', () => new THREE.MeshStandardMaterial({ color: 0xd2a656, metalness: 0.85, roughness: 0.34, envMapIntensity: 1.3 })),
  brassDark: () => mat('brassDark', () => new THREE.MeshStandardMaterial({ color: 0x9c7838, metalness: 0.8, roughness: 0.45, envMapIntensity: 1.1 })),
  iron: () => mat('iron', () => new THREE.MeshStandardMaterial({ color: 0x3c3a38, metalness: 0.6, roughness: 0.55 })),
  rope: () => mat('rope', () => new THREE.MeshStandardMaterial({ color: 0xb99a68, roughness: 1 })),
  acorn: () => mat('acorn', () => new THREE.MeshStandardMaterial({ color: 0xb8772f, roughness: 0.42, envMapIntensity: 0.8 })),
  acornCap: () => mat('acornCap', () => new THREE.MeshStandardMaterial({ map: acornCapTexture(), roughness: 0.95 })),
  shaving: () => mat('shaving', () => new THREE.MeshStandardMaterial({ color: 0xe8c690, roughness: 0.85, side: THREE.DoubleSide })),
};
const shadowMat = (o: number) => mat('shadow' + o.toFixed(2), () => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: o, color: 0x1a0f08 }));

// ------------------------------------------------------------------ small painted canvases

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function canvasTex(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A soft round contact shadow (stepped rings: it reads as a shadow, not a glow). */
let blob: THREE.Texture | null = null;
export function blobTexture(): THREE.Texture {
  if (blob) return blob;
  const [c, g] = canvas(64, 64);
  const d = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
    const a = r >= 1 ? 0 : Math.pow(1 - r, 1.4);
    d.data[(y * 64 + x) * 4 + 3] = Math.round(Math.min(1, a) * 255);
  }
  g.putImageData(d, 0, 0);
  blob = new THREE.CanvasTexture(c);
  blob.minFilter = THREE.LinearFilter;
  return blob;
}
export function contactShadow(w: number, d = w, opacity = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMat(Math.round(opacity * 20) / 20));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = 1;
  return m;
}

function acornCapTexture(): THREE.Texture {
  const [c, g] = canvas(32, 32);
  const r = rng(7);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const sc = ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 0) || y % 3 === 0;
    const v = r();
    g.fillStyle = sc ? '#4a3420' : v < 0.3 ? '#7d5a36' : v < 0.7 ? '#6a4b2c' : '#8f6a40';
    g.fillRect(x, y, 1, 1);
  }
  return canvasTex(c, true);
}

/** Kraft wrapping paper with a printed pattern of little stars and leaves. */
export function kraftTexture(): THREE.Texture {
  const [c, g] = canvas(64, 64);
  const r = rng(11);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = r();
    g.fillStyle = v < 0.08 ? '#b98f5e' : v < 0.2 ? '#cfa673' : v > 0.93 ? '#e2c093' : '#c69a66';
    g.fillRect(x, y, 1, 1);
  }
  const star = (x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); };
  for (let k = 0; k < 10; k++) star(4 + (k * 23) % 60, 5 + (k * 37) % 56, k % 2 ? '#f3e6c4' : '#a3423f');
  return canvasTex(c, true);
}

// ------------------------------------------------------------------ geometry helpers

/** A horizontal log along X centred at the origin: `len` long, radius `r`, texture tiles 2 m along and 1 m around. */
export function logGeo(len: number, r: number, seed = 1, segs = 12, ends = false): THREE.BufferGeometry {
  const rr = rng(seed);
  const lseg = Math.max(2, Math.round(len / 0.5));
  const g = new THREE.CylinderGeometry(r, r, len, segs, lseg, !ends);
  const pos = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  const wob = [rr(), rr(), rr()];
  const side = (segs + 1) * (lseg + 1);
  // each log its own shade of honey (a vertex tint), darker toward its underside where the light doesn't reach
  const tone = 0.8 + rr() * 0.26, warm = (rr() - 0.5) * 0.08;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
    const rad = Math.hypot(x, z);
    if (rad > r * 0.5) {
      // a little irregular, not a machined dowel: the radius swells and the log bows slightly
      const k = 1 + Math.sin(y * 2.3 + wob[0] * 6) * 0.04 + Math.sin(y * 7.1 + wob[1] * 9) * 0.02;
      pos.setX(i, x * k);
      pos.setZ(i, z * k + Math.sin((y / len) * Math.PI) * 0.015 * (wob[2] - 0.5));
    }
    if (i < side) uv.setXY(i, (y + len / 2) / 2 + wob[0] * 3, uv.getX(i) * 2 * Math.PI * r + wob[1]);
    // (before the turn the cylinder's x is what becomes "up": x < 0 faces down)
    const under = Math.max(0, -x / r);
    const k = tone * (1 - under * 0.28);
    col[i * 3] = k * (1 + warm); col[i * 3 + 1] = k; col[i * 3 + 2] = k * (1 - warm * 1.5);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.rotateZ(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Merge many placed copies into one geometry (one draw call). */
export function merged(parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[]): THREE.BufferGeometry {
  const gs = parts.map((p) => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); g.applyMatrix4(p.m); return g; });
  const out = mergeGeometries(gs, false)!;
  for (const g of gs) g.dispose();
  for (const p of parts) p.geo.dispose();
  return out;
}
export const mtx = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

function mesh(g: THREE.BufferGeometry, m: THREE.Material, cast = true, recv = true): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast; o.receiveShadow = recv;
  return o;
}

/** A lathe whose texture runs `tileU` metres around and `tileV` metres up. */
function lathe(prof: [number, number][], segs: number, m: THREE.Material, tileU = 1, tileV = 1): THREE.Mesh {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  const uv = g.attributes.uv as THREE.BufferAttribute, pos = g.attributes.position as THREE.BufferAttribute;
  let maxR = 0;
  for (const [r] of prof) maxR = Math.max(maxR, r);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * 2 * maxR) / tileU, pos.getY(i) / tileV);
  return mesh(g, m);
}

// ------------------------------------------------------------------ stumps (the deal pedestals)

/** A tube along `curve` whose radius tapers from r0 to r1 (roots, chains of growth, handles). */
export function taperTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, segs = 10, radial = 7, flat = 1): THREE.BufferGeometry {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const ring = radial + 1;
  for (let j = 0; j <= segs; j++) {
    const c = curve.getPointAt(j / segs), k = r0 + (r1 - r0) * Math.pow(j / segs, 0.8);
    for (let i = 0; i < ring; i++) {
      const v = j * ring + i;
      pos.setXYZ(v, c.x + (pos.getX(v) - c.x) * k, c.y + (pos.getY(v) - c.y) * k * flat, c.z + (pos.getZ(v) - c.z) * k);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A tree stump the beaver felled and sanded flat: a lumpy, ridged bark trunk that swells into its roots, gnarled
 * roots curling out into the floor, a slightly uneven end-grain top with a band of bark round it. */
export function stump(h: number, r: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const rr = rng(seed);
  const SEG = 28, RINGS = 14;
  const ph = [rr() * 6, rr() * 6, rr() * 6];
  // the bark trunk: a lathe pushed out of round by ridges and lumps, swelling into root buttresses at the foot
  const prof: [number, number][] = [[r * 1.42, -0.01]];
  for (let i = 0; i <= RINGS; i++) { const t = i / RINGS; prof.push([r * (1 + Math.pow(1 - t, 3.2) * 0.38), t * (h - 0.012)]); }
  const side = lathe(prof, SEG, M.bark(), 1.2, 1.2);
  const pos = side.geometry.attributes.position as THREE.BufferAttribute;
  const buttress = (a: number) => Math.pow(Math.max(0, Math.cos(a * 5 + ph[0])), 3);
  const radAt = (a: number, y: number) => {
    const t = Math.min(1, Math.max(0, y / h));
    const ridge = Math.sin(a * 13 + Math.sin(y * 9 + ph[1]) * 0.8) * 0.025 + Math.sin(a * 29 + ph[2]) * 0.012;
    const lump = Math.sin(a * 3 + ph[0]) * 0.04 + Math.sin(a * 2 + y * 4 + ph[2]) * 0.03;
    return 1 + ridge + lump * (0.6 + t * 0.4) + buttress(a) * Math.pow(1 - t, 2.4) * 0.34;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(z, x);
    const k = radAt(a, y);
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  side.geometry.computeVertexNormals();
  g.add(side);
  // the sawn top: end grain on an outline that follows the trunk's own wobble, a little proud of the bark
  const outline = new THREE.Shape();
  for (let k = 0; k <= SEG; k++) {
    const a = (k / SEG) * Math.PI * 2, rad = r * radAt(a, h) * 0.96;
    const x = Math.cos(a) * rad, y = -Math.sin(a) * rad;
    if (k === 0) outline.moveTo(x, y); else outline.lineTo(x, y);
  }
  const topG = new THREE.ShapeGeometry(outline, 1);
  const uv = topG.attributes.uv as THREE.BufferAttribute, tp = topG.attributes.position as THREE.BufferAttribute;
  const col = Math.floor(rr() * 2), row = Math.floor(rr() * 2);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, col * 0.5 + 0.25 + (tp.getX(i) / (r * 1.4)) * 0.23, row * 0.5 + 0.25 + (tp.getY(i) / (r * 1.4)) * 0.23);
  const top = mesh(topG, M.end(), false, true);
  top.rotation.x = -Math.PI / 2;
  top.position.y = h - 0.006;
  g.add(top);
  // a few gnaw marks round the rim: shallow scoops of bare wood
  // gnarled roots: flattened, knuckled, curling out of the buttresses and diving back into the floorboards while
  // still thick (no thin spikes lying on the floor)
  const roots: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const a = -(k / 5) * Math.PI * 2 - ph[0] / 5 + (rr() - 0.5) * 0.3;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side2 = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((rr() - 0.5) * r * 0.4);
    const len = r * (0.55 + rr() * 0.35);
    const pts = [
      dir.clone().multiplyScalar(r * 0.6).setY(h * 0.3),
      dir.clone().multiplyScalar(r * 1.08).add(side2.clone().multiplyScalar(0.25)).setY(h * 0.1 + 0.012),
      dir.clone().multiplyScalar(r * 1.0 + len * 0.6).add(side2).setY(0.028 + rr() * 0.01),
      dir.clone().multiplyScalar(r * 1.0 + len).add(side2.clone().multiplyScalar(1.3)).setY(-0.05),
    ];
    roots.push(taperTube(new THREE.CatmullRomCurve3(pts), r * 0.3, r * 0.1, 12, 8, 0.62));
  }
  g.add(mesh(mergeGeometries(roots.map((x) => x.toNonIndexed()))!, M.bark()));
  for (const x of roots) x.dispose();
  g.add(contactShadow(r * 4.4, r * 4.4, 0.55));
  g.userData.top = h;
  return g;
}

// ------------------------------------------------------------------ acorns, sacks and baskets

let acornGeo: THREE.BufferGeometry | null = null, capGeo: THREE.BufferGeometry | null = null;
function acornGeos(): [THREE.BufferGeometry, THREE.BufferGeometry] {
  if (!acornGeo) {
    const nut: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; nut.push(new THREE.Vector2(Math.sin(Math.pow(t, 0.8) * Math.PI) * 0.5 * (1 - t * 0.3) + (t > 0.95 ? 0 : 0.001), -t * 1.25)); }
    nut[0].x = 0.001;
    nut.reverse();
    acornGeo = new THREE.LatheGeometry(nut.map((v) => new THREE.Vector2(Math.max(0.001, v.x), v.y + 0.1)), 9);
    const cap: THREE.Vector2[] = [new THREE.Vector2(0.001, 0.32), new THREE.Vector2(0.18, 0.3), new THREE.Vector2(0.45, 0.22), new THREE.Vector2(0.56, 0.08), new THREE.Vector2(0.5, -0.02), new THREE.Vector2(0.38, 0.05)];
    capGeo = new THREE.LatheGeometry(cap, 9);
    const stem = new THREE.CylinderGeometry(0.04, 0.05, 0.22, 5);
    stem.translate(0, 0.4, 0);
    capGeo = mergeGeometries([capGeo.toNonIndexed(), stem.toNonIndexed()])!;
  }
  return [acornGeo, capGeo!];
}
/** A heap of acorns (instanced nut + cap) piled into a cone of radius `r`, height `h`, `n` acorns of size `s`. */
export function acornHeap(n: number, r: number, h: number, s = 0.028, seed = 3): THREE.Group {
  const [ng, cg] = acornGeos();
  const nuts = new THREE.InstancedMesh(ng, M.acorn(), n), caps = new THREE.InstancedMesh(cg, M.acornCap(), n);
  nuts.castShadow = caps.castShadow = true;
  nuts.receiveShadow = caps.receiveShadow = true;
  const rr = rng(seed);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r;
    const y = h * (1 - d / r) * (0.7 + rr() * 0.3);
    e.set((rr() - 0.5) * 2.4, rr() * 6, (rr() - 0.5) * 2.4);
    q.setFromEuler(e);
    const k = s * (0.8 + rr() * 0.4);
    m.compose(new THREE.Vector3(Math.cos(a) * d, y + k * 0.6, Math.sin(a) * d), q, new THREE.Vector3(k, k, k));
    nuts.setMatrixAt(i, m); caps.setMatrixAt(i, m);
    col.setHSL(0.075 + rr() * 0.03, 0.55 + rr() * 0.2, 0.36 + rr() * 0.14);
    nuts.setColorAt(i, col);
  }
  const g = new THREE.Group();
  g.add(nuts, caps);
  return g;
}

/** A burlap sack, open at the top and heaped with acorns (size: its height), its mouth rolled down. */
export function sack(h: number, r: number, seed = 1, acorns = 40): THREE.Group {
  const g = new THREE.Group();
  const rr = rng(seed);
  // a heavy sack slumped on its round bottom, gathered in at the neck and tied with twine, the mouth turned down
  const P: [number, number][] = [[0.001, 0], [0.7, 0], [0.95, 0.06], [1.06, 0.2], [1.08, 0.36], [1.0, 0.52], [0.86, 0.64], [0.7, 0.74], [0.66, 0.78], [0.74, 0.84], [0.88, 0.9], [0.92, 0.95]];
  const prof = P.map(([k, t]): [number, number] => [Math.max(0.001, k * r), t * h]);
  const body = lathe(prof, 32, M.burlap(), 0.22, 0.22);
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(z, x), t = y / h;
    // gathered folds bunch up at the neck and fan out below it; the body sags out of round
    const neck = Math.exp(-(((t - 0.76) / 0.12) ** 2));
    const fold = Math.pow(Math.abs(Math.sin(a * 5 + seed + t * 1.5)), 3) * (0.05 + neck * 0.16);
    const k = 1 + Math.sin(a * 2 + seed) * 0.06 + Math.sin(a * 3 + t * 6 + seed) * 0.03 - fold;
    pos.setX(i, x * k * 1.05); pos.setZ(i, z * k * 0.95);
  }
  body.geometry.computeVertexNormals();
  g.add(body);
  // twine round the neck, the turned-down mouth
  const tie = mesh(new THREE.TorusGeometry(r * 0.64, 0.012 + r * 0.02, 5, 22), M.rope());
  tie.rotation.x = Math.PI / 2;
  tie.scale.set(1.05, 0.95, 1);
  tie.position.y = h * 0.76;
  g.add(tie);
  const lip = mesh(new THREE.TorusGeometry(r * 0.9, 0.02 + r * 0.05, 6, 22), M.burlap());
  lip.rotation.x = Math.PI / 2;
  lip.scale.set(1.05, 0.95, 1);
  lip.position.y = h * 0.93;
  g.add(lip);
  if (acorns > 0) {
    const heap = acornHeap(acorns, r * 0.86, r * 0.5, Math.max(0.024, r * 0.15), seed + 4);
    heap.position.y = h * 0.86;
    g.add(heap);
  }
  g.add(contactShadow(r * 3.4, r * 3.0, 0.55));
  void rr;
  return g;
}

// ------------------------------------------------------------------ moon gems and chests

let gemGeo: THREE.BufferGeometry | null = null;
function gemGeometry(): THREE.BufferGeometry {
  if (gemGeo) return gemGeo;
  // a brilliant-ish cut: crown, girdle and pavilion
  const prof = [new THREE.Vector2(0.001, -0.6), new THREE.Vector2(0.24, -0.34), new THREE.Vector2(0.5, -0.02), new THREE.Vector2(0.5, 0.04), new THREE.Vector2(0.42, 0.16), new THREE.Vector2(0.3, 0.26), new THREE.Vector2(0.001, 0.27)];
  gemGeo = new THREE.LatheGeometry(prof, 10).toNonIndexed();
  gemGeo.computeVertexNormals();
  return gemGeo;
}
const GEM_COLS = [0xb9a6ff, 0x9fd8ff, 0xf4e7ff, 0xc8b4ff, 0xa3f0e4];
export function gemMat(col: number): THREE.MeshPhysicalMaterial {
  return mat('gem' + col, () => new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 1.1, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2, flatShading: true })) as THREE.MeshPhysicalMaterial;
}
export function gem(size: number, col = GEM_COLS[0]): THREE.Mesh {
  const m = mesh(gemGeometry(), gemMat(col), true, false);
  m.scale.setScalar(size);
  return m;
}
/** A heap of moon gems for the inside of a chest. */
export function gemHeap(n: number, w: number, d: number, s: number, seed = 5): THREE.Group {
  const g = new THREE.Group();
  const rr = rng(seed);
  for (let i = 0; i < n; i++) {
    const k = gem(s * (0.7 + rr() * 0.6), GEM_COLS[i % GEM_COLS.length]);
    k.position.set((rr() - 0.5) * w, rr() * s * 0.8, (rr() - 0.5) * d);
    k.rotation.set((rr() - 0.5) * 1.2, rr() * 6, (rr() - 0.5) * 1.2);
    g.add(k);
  }
  return g;
}

// ------------------------------------------------------------------ brass scales

const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
/** A lathe from (radius, height) pairs, smooth-shaded, in brass. */
function turned(pts: [number, number][], segs = 20, m: THREE.Material = M.brass()): THREE.Mesh {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => v2(Math.max(0.0005, r), y)), segs);
  g.computeVertexNormals();
  return mesh(g, m);
}
/** A chain of little oval links from a to b (instanced: one draw call). */
function chain(a: THREE.Vector3, b: THREE.Vector3, link = 0.012): THREE.InstancedMesh {
  const n = Math.max(2, Math.round(a.distanceTo(b) / (link * 1.5)));
  const geo = new THREE.TorusGeometry(link * 0.5, link * 0.13, 4, 8);
  geo.scale(1, 1.7, 1);
  const im = new THREE.InstancedMesh(geo, M.brassDark(), n);
  const dir = b.clone().sub(a).normalize();
  const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const twist = new THREE.Quaternion().setFromAxisAngle(dir, Math.PI / 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const p = a.clone().lerp(b, (i + 0.5) / n);
    m.compose(p, i % 2 ? twist.clone().multiply(q0) : q0, new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m);
  }
  im.castShadow = true;
  return im;
}

/** Brass balance scales: a moulded foot, a turned pillar with collars and a finial, an arched beam with a pointer,
 * two dished pans on chains, an acorn weighed against a brass weight. */
export function scales(): THREE.Group {
  const g = new THREE.Group();
  g.add(turned([[0.001, 0], [0.1, 0], [0.104, 0.008], [0.098, 0.014], [0.086, 0.018], [0.08, 0.026], [0.06, 0.034], [0.042, 0.038], [0.036, 0.046], [0.024, 0.05], [0.001, 0.05]], 24, M.brassDark()));
  g.add(turned([[0.001, 0.05], [0.018, 0.05], [0.022, 0.06], [0.016, 0.068], [0.012, 0.09], [0.011, 0.2], [0.016, 0.21], [0.022, 0.22], [0.016, 0.232], [0.011, 0.24], [0.01, 0.31], [0.018, 0.322], [0.012, 0.334], [0.001, 0.336]]));
  const fin = turned([[0.001, 0], [0.012, 0.004], [0.016, 0.014], [0.01, 0.024], [0.004, 0.034], [0.001, 0.04]]);
  fin.position.y = 0.36;
  g.add(fin);
  // the beam: a shallow arch with acorn-shaped finials and a pointer hanging over a little scale plate
  const beam = new THREE.Group();
  beam.position.y = 0.345;
  const arch = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.19, -0.012, 0), new THREE.Vector3(-0.1, 0.004, 0), new THREE.Vector3(0, 0.012, 0), new THREE.Vector3(0.1, 0.004, 0), new THREE.Vector3(0.19, -0.012, 0)]);
  beam.add(mesh(taperTube(arch, 0.0065, 0.0065, 24, 6), M.brass()));
  for (const sx of [-1, 1]) {
    const k = turned([[0.001, -0.016], [0.009, -0.01], [0.011, 0], [0.006, 0.008], [0.001, 0.012]], 10);
    k.position.set(sx * 0.19, -0.012, 0);
    beam.add(k);
  }
  const pointer = mesh(taperTube(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0.012), new THREE.Vector3(0, -0.12, 0.012)), 0.004, 0.0012, 4, 5), M.brassDark());
  beam.add(pointer);
  g.add(beam);
  const plate = turned([[0.001, 0], [0.03, 0], [0.032, 0.004], [0.001, 0.004]], 14, M.brassDark());
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0, 0.235, 0.014);
  g.add(plate);
  // pans on chains
  const pans: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(sx * 0.19, -0.012, 0);
    const pan = turned([[0.001, 0], [0.04, 0.002], [0.07, 0.012], [0.086, 0.026], [0.09, 0.03], [0.086, 0.031], [0.068, 0.017], [0.04, 0.008], [0.001, 0.006]], 24);
    pan.position.y = -0.21;
    p.add(pan);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      p.add(chain(new THREE.Vector3(0, -0.004, 0), new THREE.Vector3(Math.cos(a) * 0.08, -0.182, Math.sin(a) * 0.08), 0.011));
    }
    beam.add(p);
    pans.push(p);
  }
  const w8 = turned([[0.001, 0], [0.02, 0], [0.022, 0.004], [0.018, 0.02], [0.012, 0.024], [0.006, 0.03], [0.009, 0.036], [0.001, 0.04]], 14, M.brassDark());
  w8.position.y = -0.203;
  pans[1].add(w8);
  const a = acornHeap(3, 0.03, 0.02, 0.022, 9);
  a.position.set(0, -0.2, 0);
  pans[0].add(a);
  g.userData.beam = beam;
  g.userData.pans = pans;
  g.add(contactShadow(0.3, 0.3, 0.5));
  return g;
}

// ------------------------------------------------------------------ the gift parcel

/** A flat ribbon (width x thickness) swept along a curve, its face turned toward `up`. */
function ribbonAlong(curve: THREE.Curve<THREE.Vector3>, width: number, thick: number, segs: number, up = new THREE.Vector3(0, 1, 0), twist = 0): THREE.BufferGeometry {
  const V: number[] = [], I: number[] = [], U: number[] = [];
  for (let j = 0; j <= segs; j++) {
    const t = j / segs, p = curve.getPointAt(t), tan = curve.getTangentAt(t).normalize();
    let side = new THREE.Vector3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
    side.normalize().applyAxisAngle(tan, twist * t);
    const nrm = new THREE.Vector3().crossVectors(side, tan).normalize();
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const q = p.clone().addScaledVector(side, (a * width) / 2).addScaledVector(nrm, (b * thick) / 2);
      V.push(q.x, q.y, q.z);
      U.push((a + 1) / 2, t);
    }
    if (j < segs) for (let k = 0; k < 4; k++) { const a0 = j * 4 + k, a1 = j * 4 + ((k + 1) % 4); I.push(a0, a1, a1 + 4, a0, a1 + 4, a0 + 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/** A wrapped parcel: a soft-cornered box in printed kraft paper, a satin ribbon round it both ways, a full bow with
 * two loops and forked tails, and a paper tag on a string. */
export function parcel(s = 0.26): THREE.Group {
  const g = new THREE.Group();
  const paper = mat('kraft', () => new THREE.MeshStandardMaterial({ map: kraftTexture(), roughness: 0.88 }));
  const satin = mat('ribbon', () => new THREE.MeshStandardMaterial({ color: 0xc0383e, roughness: 0.38, envMapIntensity: 1.0 }));
  const W = s, H = s * 0.74, D = s * 0.86;
  const box = mesh(new RoundedBoxGeometry(W, H, D, 3, s * 0.035), paper);
  box.position.y = H / 2;
  g.add(box);
  const rw = s * 0.13, rt = 0.004;
  const band1 = mesh(new RoundedBoxGeometry(rw, H + rt * 2, D + rt * 2, 2, s * 0.03), satin);
  band1.position.y = H / 2;
  const band2 = mesh(new RoundedBoxGeometry(W + rt * 2, H + rt * 2, rw, 2, s * 0.03), satin);
  band2.position.y = H / 2;
  g.add(band1, band2);
  // the bow: two loops swept from the knot, two forked tails trailing over the lid
  const bow = new THREE.Group();
  const loops: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const pts = [new THREE.Vector3(0, 0.004, 0), new THREE.Vector3(sx * s * 0.08, s * 0.1, -s * 0.02), new THREE.Vector3(sx * s * 0.2, s * 0.08, 0), new THREE.Vector3(sx * s * 0.16, s * 0.01, s * 0.03), new THREE.Vector3(0, 0.004, 0.002)];
    loops.push(ribbonAlong(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), rw * 0.95, 0.004, 24, new THREE.Vector3(0, 0, 1), 0));
    const tail = [new THREE.Vector3(0, 0.002, 0), new THREE.Vector3(sx * s * 0.07, -0.004, s * 0.09), new THREE.Vector3(sx * s * 0.12, -0.002, s * 0.2), new THREE.Vector3(sx * s * 0.11, -s * 0.05, s * 0.29)];
    loops.push(ribbonAlong(new THREE.CatmullRomCurve3(tail), rw * 0.8, 0.003, 16, new THREE.Vector3(0, 1, 0), sx * 0.5));
  }
  bow.add(mesh(mergeGeometries(loops.map((x) => x.toNonIndexed()))!, satin));
  for (const x of loops) x.dispose();
  const knot = mesh(new RoundedBoxGeometry(rw * 0.9, s * 0.06, rw * 0.8, 2, s * 0.02), satin);
  knot.position.y = s * 0.025;
  bow.add(knot);
  bow.position.y = H + rt;
  g.add(bow);
  // a paper tag tied to the bow
  const tagShape = new THREE.Shape();
  const tw = s * 0.22, th = s * 0.14;
  tagShape.moveTo(-tw / 2 + th * 0.3, th / 2); tagShape.lineTo(tw / 2, th / 2); tagShape.lineTo(tw / 2, -th / 2); tagShape.lineTo(-tw / 2 + th * 0.3, -th / 2); tagShape.lineTo(-tw / 2, 0); tagShape.closePath();
  const hole = new THREE.Path(); hole.absarc(-tw / 2 + th * 0.32, 0, th * 0.12, 0, Math.PI * 2, true); tagShape.holes.push(hole);
  const tag = mesh(new THREE.ExtrudeGeometry(tagShape, { depth: 0.002, bevelEnabled: false }), mat('tagpaper', () => new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.95 })));
  tag.position.set(s * 0.26, H * 0.62, D / 2 + 0.004);
  tag.rotation.set(0, 0, -0.5);
  g.add(tag);
  const str = mesh(taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(0, H + 0.01, 0.01), new THREE.Vector3(s * 0.14, H * 0.95, D / 2 + 0.01), new THREE.Vector3(s * 0.18, H * 0.75, D / 2 + 0.006)]), 0.0016, 0.0016, 10, 4), M.rope(), false, false);
  g.add(str);
  g.add(contactShadow(s * 2, s * 2, 0.5));
  g.userData.bow = bow;
  g.userData.box = box;
  return g;
}

// ------------------------------------------------------------------ text on wood and slate (canvas)

/** The game's pixel font (Alagard), loaded for canvas painting (already present in the app; the dev page loads it). */
export function lodgeFont(): Promise<void> {
  return alagardReady();
}

/**
 * Draw text crisply in Alagard: `px` is the wished size, snapped to whole multiples of the font's 16 px grid (and
 * stepped down a whole multiple at a time until it fits `maxW`), drawn on whole pixels, the alpha thresholded so
 * letters have hard pixel edges. `y` is the middle of the capitals.
 */
function pixelText(g: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, col: string, o: { align?: CanvasTextAlign; shadow?: string; outline?: string; maxW?: number } = {}) {
  text = alagardSafe(text);
  let n = Math.max(1, Math.round(px / 16));
  if (o.maxW) { const m = canvas(4, 4)[1]; m.font = alagard(n); while (n > 1 && m.measureText(text).width > o.maxW) { n -= 1; m.font = alagard(n); } }
  // [font6] full-resolution chalk lettering, centred on y
  alagardText(g, text, x, Math.round(y + 5.5 * n), col, { n, align: o.align ?? 'center', shadow: o.shadow, outline: o.outline });
}

// ------------------------------------------------------------------ dried herbs hung from the beams

/** Hand-pixelled bunches of drying herbs (stems gathered at the top, sprays of leaves and a few flower heads), one per
 * column of a small atlas: sage, lavender, yarrow, rosemary. Alpha-cut, nearest-filtered. */
let herbTex: THREE.Texture | null = null;
function herbAtlas(): THREE.Texture {
  if (herbTex) return herbTex;
  const CW = 40, CH = 64, N = 4;
  const [c, g] = canvas(CW * N, CH);
  const kinds = [
    { stem: ['#5a6b3a', '#6f8248'], leaf: ['#5f7d46', '#7e9c5c', '#9cb878', '#c2d39a'], flower: null as string[] | null },
    { stem: ['#5b6a44', '#71824f'], leaf: ['#5d7550', '#768f62'], flower: ['#6e5498', '#8f72bc', '#b49ddc'] },
    { stem: ['#6a6a3c', '#86844c'], leaf: ['#7a8a4a', '#98a65c'], flower: ['#e8dcae', '#f6eccb', '#d8c48a'] },
    { stem: ['#4f5f36', '#62744a'], leaf: ['#3f5a3b', '#557343', '#6f8f52'], flower: null },
  ];
  for (let k = 0; k < N; k++) {
    const r = rng(31 + k * 7), K = kinds[k], ox = k * CW;
    const px = (x: number, y: number, col: string) => { if (x >= 0 && x < CW && y >= 0 && y < CH) { g.fillStyle = col; g.fillRect(ox + Math.round(x), Math.round(y), 1, 1); } };
    // stems fan out from the tie at the top
    const stems = 9 + Math.floor(r() * 4);
    for (let i = 0; i < stems; i++) {
      const ang = (i / (stems - 1) - 0.5) * 0.9 + (r() - 0.5) * 0.15, len = 40 + r() * 20;
      for (let t = 0; t < len; t++) {
        const x = CW / 2 + Math.sin(ang) * t + Math.sin(t * 0.2 + i) * 0.6, y = 4 + Math.cos(ang) * t;
        px(x, y, K.stem[(t + i) % 2]);
        if (t > 8 && t % 3 === 0) {
          for (const sd of [-1, 1]) {
            const ll = 2 + Math.floor(r() * 3);
            for (let q = 1; q <= ll; q++) px(x + sd * q, y + q * 0.6 + (q > 1 ? 1 : 0), K.leaf[Math.min(K.leaf.length - 1, Math.floor(r() * K.leaf.length))]);
          }
        }
        if (K.flower && t > len - 8) { px(x, y + 1, K.flower[Math.floor(r() * K.flower.length)]); px(x + 1, y + 2, K.flower[Math.floor(r() * K.flower.length)]); px(x - 1, y + 2, K.flower[0]); }
      }
    }
    // the twine tie
    for (let x = -3; x <= 3; x++) { px(CW / 2 + x, 4, '#c9ab74'); px(CW / 2 + x, 5, '#9c7c4c'); }
  }
  herbTex = canvasTex(c);
  herbTex.minFilter = THREE.NearestMipmapLinearFilter;
  return herbTex;
}
/** A bunch of herbs hung upside down to dry: crossed leaf cards from the atlas under a twine tie, on a string. */
export function herbBundle(seed: number, drop = 0.3): THREE.Group {
  const g = new THREE.Group();
  const rr = rng(seed);
  const kind = Math.floor(rr() * 4);
  const m = mat('herb' + kind, () => new THREE.MeshStandardMaterial({ map: herbAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }));
  const w = 0.2, h = 0.32;
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (kind + uv.getX(i)) / 4, uv.getY(i));
    const card = mesh(geo, m, true, false);
    card.position.y = -h / 2 + 0.01;
    card.rotation.y = (k / 3) * Math.PI + rr() * 0.2;
    g.add(card);
  }
  const str = mesh(taperTube(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, drop, 0)), 0.0035, 0.0035, 2, 4), M.rope(), false, false);
  g.add(str);
  g.userData.phase = rr() * 6;
  return g;
}

/** Wood-plank backing painted per pixel: grain lines, knots, chamfered lit edges, nail heads. */
function paintPlank(g: CanvasRenderingContext2D, w: number, h: number, seed: number, base = [148, 104, 62]) {
  const r = rng(seed);
  const img = g.createImageData(w, h);
  const line = new Float32Array(h).map((_, y) => Math.sin(y * 0.9 + seed) * 0.5 + (r() - 0.5));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gr = Math.sin(x * 0.045 + line[y] * 2 + Math.sin(y * 0.31 + x * 0.01) * 1.6);
    let k = 1 + gr * 0.07 + (r() - 0.5) * 0.06;
    if ((y + Math.floor(Math.sin(x * 0.02 + seed) * 2)) % 9 === 0) k -= 0.12;
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (edge === 0) k = 0.45;
    else if (edge === 1) k = x === 1 || y === 1 ? 1.28 : 0.72;
    else if (edge === 2) k *= x === 2 || y === 2 ? 1.1 : 0.9;
    const i = (y * w + x) * 4;
    img.data[i] = Math.min(255, base[0] * k); img.data[i + 1] = Math.min(255, base[1] * k); img.data[i + 2] = Math.min(255, base[2] * k); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (const [nx, ny] of [[6, 6], [w - 8, 6], [6, h - 8], [w - 8, h - 8]]) {
    g.fillStyle = '#3a3029'; g.fillRect(nx, ny, 3, 3);
    g.fillStyle = '#9a8a74'; g.fillRect(nx, ny, 2, 1);
  }
}

export interface Sign { group: THREE.Group; redraw(text: string, sub?: string): void; dispose(): void }
/** A carved wooden sign hung on two ropes (from `ropeTo` metres above its top edge), letters painted in honey. */
export function hangingSign(w: number, h: number, text: string, sub = '', ropeTo = 0.4, seed = 2): Sign {
  const g = new THREE.Group();
  const PX = 256; // texels per metre (the props' texel density; Alagard's 16 px letters fit)
  const cw = Math.round(w * PX), ch = Math.round(h * PX);
  const [c, gx] = canvas(cw, ch);
  const t = canvasTex(c);
  const draw = (tx: string, sb: string) => {
    paintPlank(gx, cw, ch, seed);
    // [font6] the name in gold 3D pixel letters (outline, extrusion, banded fill), the line under it in cream
    const n1 = fitText3D(tx, Math.round(ch * (sb ? 0.42 : 0.55)), cw - 16);
    drawText3D(gx, tx, cw / 2 - n1 * 2, Math.round((sb ? ch * 0.4 : ch / 2) + 5.5 * n1), { n: n1, palette: 'gold', depth: 2, align: 'center' });
    if (sb) { const n2 = fitText3D(sb, Math.round(ch * 0.2), cw - 16); drawText3D(gx, sb, cw / 2 - n2, Math.round(ch * 0.77 + 5.5 * n2), { n: n2, palette: 'cream', depth: 1, align: 'center' }); }
    t.needsUpdate = true;
  };
  draw(text, sub);
  void lodgeFont().then(() => draw(text, sub));
  const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  // the board's outline: a sawn plank, corners knocked off, the edges a little wavy
  const rr = rng(seed + 50);
  const shape = new THREE.Shape();
  const ch2 = Math.min(w, h) * 0.12, pts: [number, number][] = [];
  const edgePts = (x0: number, y0: number, x1: number, y1: number, n: number) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + (rr() - 0.5) * 0.004, y0 + (y1 - y0) * t + (rr() - 0.5) * 0.006]); } };
  edgePts(-w / 2 + ch2, h / 2, w / 2 - ch2 * 0.6, h / 2, 6);
  edgePts(w / 2, h / 2 - ch2 * 0.6, w / 2, -h / 2 + ch2, 3);
  edgePts(w / 2 - ch2, -h / 2, -w / 2 + ch2 * 0.7, -h / 2, 6);
  edgePts(-w / 2, -h / 2 + ch2 * 0.7, -w / 2, h / 2 - ch2, 3);
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -0.015);
  t.repeat.set(1 / w, 1 / h); t.offset.set(0.5, 0.5); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const board = new THREE.Mesh(geo, [face, M.boardDark()]);
  board.castShadow = true; board.receiveShadow = true;
  g.add(board);
  for (const sx of [-1, 1]) {
    const rope = mesh(taperTube(new THREE.LineCurve3(new THREE.Vector3(sx * w * 0.36, h / 2 - 0.01, 0), new THREE.Vector3(sx * w * 0.33, h / 2 + ropeTo, 0)), 0.006, 0.006, 2, 5), M.rope(), false, false);
    g.add(rope);
    const ring = mesh(new THREE.TorusGeometry(0.014, 0.004, 5, 10), M.iron(), false, false);
    ring.position.set(sx * w * 0.36, h / 2 - 0.002, 0.022);
    g.add(ring);
  }
  return { group: g, redraw: draw, dispose: () => { t.dispose(); face.dispose(); board.geometry.dispose(); } };
}

/** A slate in a wooden frame for chalked notes; `draw` repaints its face. */
export interface Slate { group: THREE.Group; draw(lines: { text: string; size: number; col?: string }[]): void; dispose(): void }
export function slate(w: number, h: number): Slate {
  const g = new THREE.Group();
  const PX = 220;
  const cw = Math.round(w * PX), ch = Math.round(h * PX);
  const [c, gx] = canvas(cw, ch);
  const t = canvasTex(c);
  const r = rng(4);
  let last: { text: string; size: number; col?: string }[] = [];
  const draw = (lines: { text: string; size: number; col?: string }[]) => {
    last = lines;
    const img = gx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const v = r();
      const smear = Math.sin(x * 0.03 + y * 0.012) * 0.5 + 0.5;
      const i = (y * cw + x) * 4;
      const base = v < 0.1 ? 52 : v > 0.96 ? 78 : 60;
      img.data[i] = base * 0.62 + smear * 9; img.data[i + 1] = base * 0.72 + smear * 10; img.data[i + 2] = base * 0.7 + smear * 9; img.data[i + 3] = 255;
    }
    gx.putImageData(img, 0, 0);
    let y = ch * 0.1;
    const total = lines.reduce((a, l) => a + l.size * 1.25, 0);
    y = (ch - total) / 2;
    for (const l of lines) { pixelText(gx, l.text, cw / 2, y + l.size * 0.62, l.size, l.col ?? '#ece9dc', { maxW: cw - 16 }); y += l.size * 1.25; }
    // chalk dust along the bottom
    for (let k = 0; k < 140; k++) { gx.fillStyle = 'rgba(236,233,220,0.25)'; gx.fillRect(Math.floor(r() * cw), Math.floor(ch - 2 - r() * 10), 1, 1); }
    t.needsUpdate = true;
  };
  draw([]);
  void lodgeFont().then(() => draw(last));
  const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  const fm = M.board();
  const board = mesh(new THREE.PlaneGeometry(w, h), face, false, true);
  board.position.z = 0.012;
  g.add(board);
  const fw = 0.045;
  const frame = merged([
    { geo: new RoundedBoxGeometry(w + 2 * fw, fw, 0.035, 2, 0.01), m: mtx(0, h / 2 + fw / 2, 0.012) },
    { geo: new RoundedBoxGeometry(w + 2 * fw, fw, 0.035, 2, 0.01), m: mtx(0, -h / 2 - fw / 2, 0.012) },
    { geo: new RoundedBoxGeometry(fw, h + fw, 0.035, 2, 0.01), m: mtx(-w / 2 - fw / 2, 0, 0.012) },
    { geo: new RoundedBoxGeometry(fw, h + fw, 0.035, 2, 0.01), m: mtx(w / 2 + fw / 2, 0, 0.012) },
    { geo: new RoundedBoxGeometry(w, h, 0.012, 1, 0.004), m: mtx(0, 0, 0.0) },
  ]);
  g.add(mesh(frame, fm));
  return { group: g, draw, dispose: () => { t.dispose(); face.dispose(); board.geometry.dispose(); frame.dispose(); } };
}

// ------------------------------------------------------------------ cloth banners

/** A cloth banner hung from a dowel: the art (an image URL) printed on canvas cloth, gentle folds, tassels. */
export interface Banner { group: THREE.Group; cloth: THREE.Mesh; setArt(url: string): void; sway(t: number, k: number): void; dispose(): void }
export function banner(w: number, h: number, edge: number, seed = 1): Banner {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h, 12, 16);
  geo.translate(0, -h / 2, 0);
  const base = (geo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, side: THREE.DoubleSide });
  const cloth = mesh(geo, clothMat);
  g.add(cloth);
  // dowels top and bottom with brass end caps, a cord up to the beam
  const dowel = (y: number) => {
    const d = mesh(taperTube(new THREE.LineCurve3(new THREE.Vector3(-w / 2 - 0.05, y, 0), new THREE.Vector3(w / 2 + 0.05, y, 0)), 0.018, 0.018, 4, 8), M.boardDark());
    g.add(d);
    for (const sx of [-1, 1]) {
      const f = turned([[0.001, 0], [0.016, 0.004], [0.02, 0.016], [0.012, 0.026], [0.022, 0.042], [0.026, 0.058], [0.018, 0.072], [0.006, 0.08], [0.001, 0.082]], 10);
      f.rotation.z = -sx * Math.PI / 2;
      f.position.set(sx * (w / 2 + 0.05), y, 0);
      g.add(f);
    }
  };
  dowel(0); dowel(-h - 0.005);
  // tassels: a knotted head, a collar, a skirt of threads
  const tasselM = mat('tassel' + edge, () => new THREE.MeshStandardMaterial({ color: edge, roughness: 0.9 }));
  for (const sx of [-0.33, 0, 0.33]) {
    const ts = turned([[0.001, 0], [0.012, -0.004], [0.016, -0.016], [0.008, -0.026], [0.011, -0.03], [0.008, -0.034], [0.014, -0.06], [0.022, -0.11], [0.026, -0.128], [0.001, -0.13]], 12, tasselM);
    const pos = ts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < -0.04) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); const k = 1 + Math.sin(a * 9) * 0.12; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); } }
    ts.geometry.computeVertexNormals();
    ts.position.set(sx * w, -h - 0.02, 0);
    g.add(ts);
  }
  let artTex: THREE.Texture | null = null;
  const rr = rng(seed);
  const ph = rr() * 6;
  return {
    group: g, cloth,
    setArt(url: string) {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      artTex?.dispose();
      artTex = t;
      clothMat.map = t;
      clothMat.needsUpdate = true;
    },
    sway(time: number, k: number) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const v = -y / h;
        pos.setZ(i, (Math.sin(x * 9 + ph) * 0.012 + Math.sin(time * 1.3 + v * 2.2 + x * 3 + ph) * 0.018 * v * k) * (0.3 + v));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
    dispose() { artTex?.dispose(); clothMat.dispose(); geo.dispose(); },
  };
}

// ------------------------------------------------------------------ wood shavings

/** Curls of pale wood shavings scattered over the floor in patches (instanced). */
export function shavings(spots: { x: number; z: number; r: number; n: number }[], seed = 9): THREE.InstancedMesh {
  // a curl: a narrow ribbon wound into a loose helix
  const pts: number[] = [], idx: number[] = [], uvs: number[] = [];
  const turns = 1.5, n = 18, wid = 0.02;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2, rad = 0.018 * (1 - t * 0.45);
    const x = Math.cos(a) * rad * 1.7, y = Math.sin(a) * rad * 1.7 + rad * 1.7, z = t * 0.05;
    pts.push(x, y, z - wid / 2, x, y, z + wid / 2);
    uvs.push(t, 0, t, 1);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const total = spots.reduce((a, s) => a + s.n, 0);
  const im = new THREE.InstancedMesh(geo, M.shaving(), total);
  im.castShadow = true; im.receiveShadow = true;
  const rr = rng(seed);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  let k = 0;
  for (const s of spots) for (let i = 0; i < s.n; i++) {
    const a = rr() * Math.PI * 2, d = Math.pow(rr(), 0.7) * s.r;
    e.set((rr() - 0.5) * 0.5, rr() * 6.3, (rr() - 0.5) * 0.5);
    q.setFromEuler(e);
    const sc = 0.7 + rr() * 0.8;
    m.compose(new THREE.Vector3(s.x + Math.cos(a) * d, 0.001, s.z + Math.sin(a) * d), q, new THREE.Vector3(sc, sc, sc));
    im.setMatrixAt(k, m);
    col.setHSL(0.09 + rr() * 0.025, 0.3 + rr() * 0.12, 0.66 + rr() * 0.12);
    im.setColorAt(k, col);
    k++;
  }
  return im;
}
