// The lodge store's building kit: peeled logs, stick lattices, gnawed stumps, wooden barrels with brass hoops, burlap
// acorn sacks heaped with acorns, gem chests full of glowing moon gems, brass scales, a wrapped parcel, a chalk slate,
// cloth banners, carved hanging signs and curls of wood shavings. Geometry is built here (lathes, tubes, boxes) and
// dressed in the shop's hand-painted pixel textures (public/models/shop/tex, from BUSHED's CC0 photo-based set) and
// in pixel canvases painted in code. Real light does the shading. OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { modelUrl } from '../../gfx/glb.ts';
import { rng } from '../../gfx/noise.ts';

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
  log: () => mat('log', () => new THREE.MeshStandardMaterial({ map: tex('log'), color: 0xd6d4d0, normalMap: tex('log_n', false), normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.86 })),
  end: () => mat('end', () => new THREE.MeshStandardMaterial({ map: tex('end'), roughness: 0.9 })),
  bark: () => mat('bark', () => new THREE.MeshStandardMaterial({ map: tex('bark'), normalMap: tex('bark_n', false), normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.95 })),
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
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
    const rad = Math.hypot(x, z);
    if (rad > r * 0.5) {
      // a little irregular, not a machined dowel: the radius swells and the log bows slightly
      const k = 1 + Math.sin(y * 2.3 + wob[0] * 6) * 0.04 + Math.sin(y * 7.1 + wob[1] * 9) * 0.02;
      pos.setX(i, x * k);
      pos.setZ(i, z * k + Math.sin((y / len) * Math.PI) * 0.015 * (wob[2] - 0.5));
    }
    if (uv.getY(i) > 0 && uv.getY(i) < 1) uv.setXY(i, (y + len / 2) / 2 + wob[0] * 3, uv.getX(i) * 2 * Math.PI * r + wob[1]);
  }
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

/** A tree stump the beaver felled and sanded flat: bark sides, flared roots, an end-grain top with tooth marks. */
export function stump(h: number, r: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const rr = rng(seed);
  const prof: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, y = t * (h - 0.02);
    const flare = Math.pow(1 - t, 3) * 0.32 * r;
    prof.push([r * (1 + Math.sin(t * 9 + seed) * 0.015) + flare, y]);
  }
  prof.unshift([r * 1.3, -0.01]);
  const side = lathe(prof, 18, M.bark(), 1.5, 1.5);
  g.add(side);
  // the top: end grain (one of the four caps in the texture), a little proud of the bark
  const topG = new THREE.CircleGeometry(r * 0.97, 22);
  const uv = topG.attributes.uv as THREE.BufferAttribute;
  const q = Math.floor(rr() * 2) * 0.5 + 0.5;  // fresh caps sit in the right-hand column
  const row = Math.floor(rr() * 2) * 0.5;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (q === 0.5 ? 0.5 : 0) + 0.02 + uv.getX(i) * 0.46, row + 0.02 + uv.getY(i) * 0.46);
  const top = mesh(topG, M.end(), false, true);
  top.rotation.x = -Math.PI / 2;
  top.position.y = h - 0.018;
  g.add(top);
  const rim = mesh(new THREE.TorusGeometry(r * 0.985, 0.018, 5, 22), M.bark());
  rim.rotation.x = Math.PI / 2;
  rim.position.y = h - 0.02;
  g.add(rim);
  // roots running out into the floor
  const roots: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
  const n = 5;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rr() * 0.6;
    const len = r * (0.9 + rr() * 0.6);
    const geo = new THREE.CylinderGeometry(0.012, r * 0.22, len, 6, 1);
    geo.translate(0, len / 2, 0);
    geo.rotateZ(-Math.PI / 2 + 0.28);
    const m = new THREE.Matrix4().makeRotationY(-a).premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * r * 0.75, 0.0, Math.sin(a) * r * 0.75));
    roots.push({ geo, m });
  }
  const rt = mesh(merged(roots), M.bark());
  g.add(rt);
  g.add(contactShadow(r * 4.2, r * 4.2, 0.55));
  g.userData.top = h;
  return g;
}

// ------------------------------------------------------------------ barrels

/** A coopered barrel: staves (warm boards), iron or brass hoops, a lid. Returns the group and its lid. */
export function barrel(h: number, r: number, o: { brass?: boolean; lid?: boolean } = {}): { group: THREE.Group; lid: THREE.Object3D; body: THREE.Mesh } {
  const g = new THREE.Group();
  const prof: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push([r * (0.84 + Math.sin(t * Math.PI) * 0.16), t * h]); }
  const body = lathe(prof, 24, M.board(), 0.9, 1.0);
  // stave seams: darken every other face by a subtle vertex colour
  g.add(body);
  const hoopM = o.brass ? M.brass() : M.iron();
  for (const t of [0.07, 0.24, 0.76, 0.93]) {
    const rr = r * (0.84 + Math.sin(t * Math.PI) * 0.16) + 0.006;
    const hoop = mesh(new THREE.CylinderGeometry(rr, rr, h * 0.045, 24, 1, true), hoopM);
    hoop.position.y = t * h;
    g.add(hoop);
  }
  const lid = new THREE.Group();
  const top = mesh(new THREE.CylinderGeometry(r * 0.83, r * 0.83, 0.025, 24), M.boardDark());
  top.position.y = 0;
  lid.add(top);
  lid.position.y = h - 0.03;
  if (o.lid !== false) g.add(lid);
  g.add(contactShadow(r * 3.2, r * 3.2, 0.6));
  return { group: g, lid, body };
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
  const prof: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const bulge = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.62 + 0.25) * r;
    prof.push([Math.max(0.01, bulge * (t > 0.85 ? 0.92 + (rr() - 0.5) * 0.06 : 1)), t * h]);
  }
  prof.unshift([r * 0.62, 0]);
  prof.unshift([0.001, 0]);
  const body = lathe(prof, 28, M.burlap(), 0.18, 0.18);
  // slumped, lumpy: squash the lathe a little out of round
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(z, x);
    const fold = Math.pow(Math.abs(Math.sin(a * 4 + seed + y * 2.5)), 6) * 0.08 * Math.min(1, y / (h * 0.5));
    const k = 1 + Math.sin(a * 3 + seed) * 0.05 + Math.sin(a * 5 + y * 9) * 0.03 - fold;
    const slump = 1 + Math.max(0, 0.25 - y / h) * 0.3;
    pos.setX(i, x * k * 1.06 * slump); pos.setZ(i, z * k * 0.94 * slump);
  }
  body.geometry.computeVertexNormals();
  g.add(body);
  // the rolled-down mouth
  const lip = mesh(new THREE.TorusGeometry(prof[prof.length - 1][0] * 1.02, 0.025 + r * 0.04, 6, 20), M.burlap());
  lip.rotation.x = Math.PI / 2;
  lip.scale.set(1.06, 0.94, 1);
  lip.position.y = h - 0.01;
  g.add(lip);
  if (acorns > 0) {
    const heap = acornHeap(acorns, prof[prof.length - 1][0] * 0.95, r * 0.45, Math.max(0.022, r * 0.16), seed + 4);
    heap.position.y = h - r * 0.12;
    g.add(heap);
  }
  g.add(contactShadow(r * 3.4, r * 3.0, 0.55));
  return g;
}

// ------------------------------------------------------------------ moon gems and chests

let gemGeo: THREE.BufferGeometry | null = null;
function gemGeometry(): THREE.BufferGeometry {
  if (gemGeo) return gemGeo;
  // a brilliant-ish cut: crown, girdle and pavilion
  const prof = [new THREE.Vector2(0.001, -0.62), new THREE.Vector2(0.5, 0.0), new THREE.Vector2(0.5, 0.08), new THREE.Vector2(0.3, 0.3), new THREE.Vector2(0.001, 0.3)];
  gemGeo = new THREE.LatheGeometry(prof, 8).toNonIndexed();
  gemGeo.computeVertexNormals();
  return gemGeo;
}
const GEM_COLS = [0xb9a6ff, 0x9fd8ff, 0xf4e7ff, 0xc8b4ff, 0xa3f0e4];
export function gemMat(col: number): THREE.MeshPhysicalMaterial {
  return mat('gem' + col, () => new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2, flatShading: true })) as THREE.MeshPhysicalMaterial;
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

/** A small wooden chest with brass corner bands, its lid thrown open, moon gems heaped inside. */
export function chest(w: number, h: number, d: number, seed = 1, gems = 9): THREE.Group {
  const g = new THREE.Group();
  const t = 0.022;
  const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const b = new THREE.BoxGeometry(sx, sy, sz);
    const uv = b.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(sx, sz) * 0.5, uv.getY(i) * sy * 0.5 + seed * 0.13);
    parts.push({ geo: b, m: mtx(x, y, z) });
  };
  box(w, t, d, 0, t / 2, 0);
  box(w, h, t, 0, h / 2, d / 2 - t / 2);
  box(w, h, t, 0, h / 2, -d / 2 + t / 2);
  box(t, h, d - 2 * t, w / 2 - t / 2, h / 2, 0);
  box(t, h, d - 2 * t, -w / 2 + t / 2, h / 2, 0);
  g.add(mesh(merged(parts), M.board()));
  // brass bands round the corners and the rim
  const bands: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
  const bt = 0.008, bw = Math.min(w, d) * 0.12;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bands.push({ geo: new THREE.BoxGeometry(bw, h + 0.004, bt), m: mtx(sx * (w / 2 - bw / 2), h / 2, sz * (d / 2 + bt / 2 - 0.001)) });
    bands.push({ geo: new THREE.BoxGeometry(bt, h + 0.004, bw), m: mtx(sx * (w / 2 + bt / 2 - 0.001), h / 2, sz * (d / 2 - bw / 2)) });
  }
  bands.push({ geo: new THREE.BoxGeometry(w + 0.01, 0.014, d + 0.01), m: mtx(0, h - 0.007, 0) });
  // a hasp on the front
  bands.push({ geo: new THREE.BoxGeometry(0.03, 0.045, 0.012), m: mtx(0, h - 0.03, d / 2 + 0.006) });
  g.add(mesh(merged(bands), M.brass()));
  // the lid, hinged at the back and thrown open
  const lid = new THREE.Group();
  const lidG = new THREE.CylinderGeometry(d / 2, d / 2, w, 10, 1, false, 0, Math.PI);
  lidG.rotateZ(Math.PI / 2);
  lidG.rotateX(-Math.PI / 2);
  const lidM = mesh(lidG, M.boardDark());
  lidM.scale.set(1, 0.55, 1);
  lidM.position.set(0, 0, d / 2);
  lid.add(lidM);
  const lb = mesh(new THREE.BoxGeometry(w + 0.012, 0.012, 0.012), M.brass());
  lb.position.set(0, 0, d);
  lid.add(lb);
  lid.position.set(0, h, -d / 2);
  lid.rotation.x = -1.95;
  g.add(lid);
  if (gems > 0) {
    const heap = gemHeap(gems, w * 0.7, d * 0.6, Math.min(w, d) * 0.16, seed + 2);
    heap.position.y = h * 0.78;
    g.add(heap);
  }
  g.add(contactShadow(w * 1.8, d * 2.0, 0.55));
  g.userData.lid = lid;
  return g;
}

// ------------------------------------------------------------------ brass scales

export function scales(): THREE.Group {
  const g = new THREE.Group();
  const B = M.brass();
  const base = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0.095, 0.012), new THREE.Vector2(0.07, 0.03), new THREE.Vector2(0.03, 0.04), new THREE.Vector2(0.018, 0.05), new THREE.Vector2(0.001, 0.05)], 16);
  g.add(mesh(base, M.brassDark()));
  const col = mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.3, 8), B);
  col.position.y = 0.2;
  g.add(col);
  const knob = mesh(new THREE.SphereGeometry(0.02, 8, 6), B);
  knob.position.y = 0.37;
  g.add(knob);
  const beam = new THREE.Group();
  beam.position.y = 0.35;
  beam.add(mesh(new THREE.BoxGeometry(0.36, 0.012, 0.016), B));
  g.add(beam);
  const pans: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(sx * 0.17, 0, 0);
    const pan = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.05, 0.004), new THREE.Vector2(0.085, 0.022), new THREE.Vector2(0.088, 0.026)], 16);
    const pm = mesh(pan, B);
    pm.position.y = -0.2;
    p.add(pm);
    // three chains to the beam end
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const from = new THREE.Vector3(Math.cos(a) * 0.075, -0.18, Math.sin(a) * 0.075), to = new THREE.Vector3(0, 0, 0);
      const len = from.distanceTo(to);
      const ch = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, len, 4), M.brassDark(), false, false);
      ch.position.copy(from).add(to).multiplyScalar(0.5);
      ch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      p.add(ch);
    }
    beam.add(p);
    pans.push(p);
  }
  // an acorn weighed against a little brass weight
  const w8 = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 8), M.brassDark());
  w8.position.set(0, -0.17, 0);
  pans[1].add(w8);
  const a = acornHeap(3, 0.03, 0.02, 0.022, 9);
  a.position.set(0, -0.185, 0);
  pans[0].add(a);
  g.userData.beam = beam;
  g.userData.pans = pans;
  g.add(contactShadow(0.3, 0.3, 0.5));
  return g;
}

// ------------------------------------------------------------------ the gift parcel

export function parcel(s = 0.26): THREE.Group {
  const g = new THREE.Group();
  const paper = mat('kraft', () => new THREE.MeshStandardMaterial({ map: kraftTexture(), roughness: 0.9 }));
  const ribbonM = mat('ribbon', () => new THREE.MeshStandardMaterial({ color: 0xc0383e, roughness: 0.5, envMapIntensity: 0.8 }));
  const box = mesh(new THREE.BoxGeometry(s, s * 0.78, s * 0.86), paper);
  box.position.y = s * 0.39;
  g.add(box);
  const rw = s * 0.14;
  const r1 = mesh(new THREE.BoxGeometry(rw, s * 0.79, s * 0.87), ribbonM);
  r1.position.y = s * 0.39;
  const r2 = mesh(new THREE.BoxGeometry(s * 1.01, s * 0.79, rw), ribbonM);
  r2.position.y = s * 0.39;
  g.add(r1, r2);
  const bow = new THREE.Group();
  for (const sx of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(s * 0.16, s * 0.035, 6, 12), ribbonM);
    loop.scale.set(1, 0.65, 0.5);
    loop.position.set(sx * s * 0.15, s * 0.07, 0);
    loop.rotation.set(0, sx * 0.4, sx * 0.5);
    bow.add(loop);
  }
  const knot = mesh(new THREE.SphereGeometry(s * 0.06, 8, 6), ribbonM);
  bow.add(knot);
  bow.position.y = s * 0.79;
  g.add(bow);
  g.add(contactShadow(s * 2, s * 2, 0.5));
  g.userData.bow = bow;
  g.userData.box = box;
  return g;
}

// ------------------------------------------------------------------ text on wood and slate (canvas)

let fontReady: Promise<void> | null = null;
/** The game's pixel font, loaded for canvas painting (already present in the app; the dev page loads it). */
export function lodgeFont(): Promise<void> {
  if (!fontReady) {
    fontReady = (async () => {
      try {
        if (!document.fonts.check('24px "TBME Body"')) {
          const url = new URL('../../assets/fonts/TBMEGoofy-Regular.woff2', import.meta.url).href;
          const f = new FontFace('TBME Body', `url(${url})`);
          document.fonts.add(await f.load());
        }
        await document.fonts.load('24px "TBME Body"');
      } catch { /* the fallback font will do */ }
    })();
  }
  return fontReady;
}
const FONT = '"TBME Body", ui-monospace, monospace';

/** Draw text crisply (no smoothing): render large, then threshold the alpha so letters have hard pixel edges. */
function pixelText(g: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, col: string, o: { align?: CanvasTextAlign; shadow?: string; outline?: string; maxW?: number } = {}) {
  const [c2, g2] = canvas(g.canvas.width, g.canvas.height);
  g2.font = `${px}px ${FONT}`;
  g2.textAlign = o.align ?? 'center';
  g2.textBaseline = 'middle';
  let size = px;
  if (o.maxW) { while (size > 8 && g2.measureText(text).width > o.maxW) { size -= 1; g2.font = `${size}px ${FONT}`; } }
  g2.fillStyle = '#000';
  g2.fillText(text, x, y);
  const d = g2.getImageData(0, 0, c2.width, c2.height);
  const paint = (dx: number, dy: number, hex: string) => {
    const [r, gg, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const out = g.getImageData(0, 0, c2.width, c2.height);
    for (let yy = 0; yy < c2.height; yy++) for (let xx = 0; xx < c2.width; xx++) {
      const sx = xx - dx, sy = yy - dy;
      if (sx < 0 || sy < 0 || sx >= c2.width || sy >= c2.height) continue;
      if (d.data[(sy * c2.width + sx) * 4 + 3] > 110) { const i = (yy * c2.width + xx) * 4; out.data[i] = r; out.data[i + 1] = gg; out.data[i + 2] = b; out.data[i + 3] = 255; }
    }
    g.putImageData(out, 0, 0);
  };
  if (o.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) paint(dx, dy, o.outline);
  if (o.shadow) paint(0, 2, o.shadow);
  paint(0, 0, col);
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
  const PX = 160; // texels per metre
  const cw = Math.round(w * PX), ch = Math.round(h * PX);
  const [c, gx] = canvas(cw, ch);
  const t = canvasTex(c);
  const draw = (tx: string, sb: string) => {
    paintPlank(gx, cw, ch, seed);
    pixelText(gx, tx, cw / 2, sb ? ch * 0.4 : ch / 2, Math.round(ch * (sb ? 0.42 : 0.55)), '#f6dc9a', { shadow: '#3b2a1c', outline: '#4a2f1d', maxW: cw - 24 });
    if (sb) pixelText(gx, sb, cw / 2, ch * 0.77, Math.round(ch * 0.2), '#f2e7cf', { outline: '#4a2f1d', maxW: cw - 24 });
    t.needsUpdate = true;
  };
  draw(text, sub);
  void lodgeFont().then(() => draw(text, sub));
  const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  const edge = M.boardDark();
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), [edge, edge, edge, edge, face, edge]);
  board.castShadow = true; board.receiveShadow = true;
  g.add(board);
  for (const sx of [-1, 1]) {
    const rope = mesh(new THREE.CylinderGeometry(0.006, 0.006, ropeTo, 5), M.rope(), false, false);
    rope.position.set(sx * w * 0.36, h / 2 + ropeTo / 2, 0);
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
    for (const l of lines) { pixelText(gx, l.text, cw / 2, y + l.size * 0.62, l.size, l.col ?? '#ece9dc', { maxW: cw - 20 }); y += l.size * 1.25; }
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
    { geo: new THREE.BoxGeometry(w + 2 * fw, fw, 0.035), m: mtx(0, h / 2 + fw / 2, 0.012) },
    { geo: new THREE.BoxGeometry(w + 2 * fw, fw, 0.035), m: mtx(0, -h / 2 - fw / 2, 0.012) },
    { geo: new THREE.BoxGeometry(fw, h, 0.035), m: mtx(-w / 2 - fw / 2, 0, 0.012) },
    { geo: new THREE.BoxGeometry(fw, h, 0.035), m: mtx(w / 2 + fw / 2, 0, 0.012) },
    { geo: new THREE.BoxGeometry(w, h, 0.012), m: mtx(0, 0, 0.0) },
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
  const dw = mesh(new THREE.CylinderGeometry(0.02, 0.02, w + 0.14, 8), M.boardDark());
  dw.rotation.z = Math.PI / 2;
  g.add(dw);
  const db = dw.clone();
  db.position.y = -h - 0.005;
  g.add(db);
  for (const sx of [-1, 1]) for (const y of [0, -h - 0.005]) {
    const cap = mesh(new THREE.SphereGeometry(0.03, 8, 6), M.brass());
    cap.position.set(sx * (w / 2 + 0.07), y, 0);
    g.add(cap);
  }
  // tassels hang from the bottom dowel
  const tasselM = mat('tassel' + edge, () => new THREE.MeshStandardMaterial({ color: edge, roughness: 0.9 }));
  for (const sx of [-0.33, 0, 0.33]) {
    const ts = mesh(new THREE.ConeGeometry(0.03, 0.12, 6), tasselM);
    ts.rotation.x = Math.PI;
    ts.position.set(sx * w, -h - 0.08, 0);
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
