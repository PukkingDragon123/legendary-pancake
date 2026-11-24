// [look4] The world beyond the clearing, so the diorama never shows the end of the ground: the valley floor rolling
// on to the horizon (outerY), a dense forest of bushy leaf-card trees in three belts that get sparser and larger
// with distance (all on the shared leaf atlas, lit by the same sun and sky), and three ridges of hills and
// mountains standing in aerial perspective round the whole horizon (painted in the sky's colours: blue-green
// forested hills, then paler hills, then far mountains with snowy tops, sinking into the horizon haze).
import * as THREE from 'three';
import { fbm, hash, rng } from '../gfx/noise.ts';
import type { SeasonInfo } from './astro.ts';
import { canopy, conifer, leafMaterial, withLeafState, type LeafCell } from './foliage.ts';
import type { ForestPlan } from './flora.ts';
import { HALF, SEED } from './layout.ts';
import { outerY } from './terrain.ts';
import { tex } from './bushed/textures.ts';
import type { Sky } from './sky.ts';

/** keep the view from the default cameras down onto the clearing clear of tall trees */
export const inViewWedge = (x: number, z: number) => z > 7 && Math.abs(x) < (z - 7) * 1.25 + 9;

const RIDGE_VS = /* glsl */ `
attribute float aTop; attribute float aSide;
varying float vTop; varying float vSide; varying vec2 vXZ; varying float vY;
void main() {
  vTop = aTop; vSide = aSide; vXZ = position.xz; vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RIDGE_FS = /* glsl */ `
uniform vec3 uBody; uniform vec3 uLit; uniform vec3 uHaze; uniform vec3 uSnow; uniform float uSnowLine; uniform float uTrees; uniform float uTime;
varying float vTop; varying float vSide; varying vec2 vXZ; varying float vY;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  // lit slopes face the sun, the haze thickens towards the foot of the ridge
  float lit = clamp(vSide, 0.0, 1.0);
  vec3 col = mix(uBody, uLit, floor(lit * 3.0 + bayer4(gl_FragCoord.xy) * 0.99) / 3.0);
  // forested ridges: crowns as a mottled painted texture
  if (uTrees > 0.0) {
    float a = atan(vXZ.y, vXZ.x) * 160.0;
    float m = h21(floor(vec2(a, vY * 0.9))) * 0.5 + h21(floor(vec2(a * 0.5, vY * 0.45))) * 0.5;
    col *= 1.0 - uTrees * 0.14 * step(0.55, m);
  }
  col = mix(col, uSnow, step(uSnowLine, vY) * step(0.6, vTop));
  col = mix(col, uHaze, clamp(1.0 - vTop, 0.0, 1.0) * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

interface Ridge { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; haze: number; body: THREE.Color; trees: number }

export class Vista {
  readonly group = new THREE.Group();
  private ridges: Ridge[] = [];
  private trees: { mesh: THREE.InstancedMesh; deciduous: boolean }[] = [];
  private groundMat: THREE.MeshLambertMaterial;

  constructor(_plan: ForestPlan, quality: 'low' | 'high') {
    this.group.name = 'vista';
    this.groundMat = this.buildGround();
    this.buildForest(quality);
    this.buildRidges();
  }

  // ---------------------------------------------------------------- the valley floor
  private buildGround(): THREE.MeshLambertMaterial {
    // rings of vertices growing out from the clearing's border (sampled every half block, like the terrain)
    const per = 2, side = HALF * 2 * per, ring: [number, number][] = [];
    for (let i = 0; i < side; i++) ring.push([-HALF + i / per, -HALF]);
    for (let i = 0; i < side; i++) ring.push([HALF, -HALF + i / per]);
    for (let i = 0; i < side; i++) ring.push([HALF - i / per, HALF]);
    for (let i = 0; i < side; i++) ring.push([-HALF, HALF - i / per]);
    const n = ring.length, rings = 34;
    const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
    const c = new THREE.Color(), meadow = new THREE.Color(0x8ab858), forest = new THREE.Color(0x4a7036), far = new THREE.Color(0x3c5c34);
    for (let k = 0; k <= rings; k++) {
      const s = 1 + Math.pow(k / rings, 2.1) * 19;
      const circ = Math.min(1, (s - 1) / 2.5);
      for (let i = 0; i < n; i++) {
        const [px, pz] = ring[i];
        const l = Math.hypot(px, pz);
        const x = THREE.MathUtils.lerp(px * s, (px / l) * HALF * 1.18 * s, circ), z = THREE.MathUtils.lerp(pz * s, (pz / l) * HALF * 1.18 * s, circ);
        pos.push(x, k === 0 ? outerY(px, pz) : outerY(x, z), z);
        uv.push(x / 3, z / 3);
        const d = Math.hypot(x, z), w = inViewWedge(x, z) ? 1 : 0;
        c.copy(forest).lerp(meadow, w * 0.8).lerp(far, Math.min(1, Math.max(0, (d - 60) / 140)));
        const v = 0.9 + hash(i, k, 3, SEED) * 0.2;
        col.push(c.r * v, c.g * v, c.b * v);
        if (k < rings) {
          const a = k * n + i, b = k * n + ((i + 1) % n), a2 = a + n, b2 = b + n;
          idx.push(a, b2, a2, a, b, b2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const map = tex('forest_floor', { repeat: true });
    const mat = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    mat.name = 'vista-ground';
    const m = new THREE.Mesh(geo, mat);
    m.name = 'vista-ground';
    m.receiveShadow = true;
    this.group.add(m);
    return mat;
  }

  // ---------------------------------------------------------------- the forest to the horizon
  private buildForest(quality: 'low' | 'high') {
    const r = rng(SEED ^ 0x5eed);
    const leaf = leafMaterial();
    // cheap far trees: a few puffs of big leaf cards, or a short stack of needle tiers, on a plain trunk; three levels
    // of detail by belt (the near belt keeps inner hulls so it never reads see-through)
    type Kind = { conifer: boolean; geo: THREE.BufferGeometry[] };
    const broad = (cells: LeafCell[], seed: number, tall = 1): Kind => {
      const P = [{ x: 0, y: 4.1 * tall, z: 0, r: 1.95, sy: 0.85 }, { x: 1.15, y: 3.3 * tall, z: 0.4, r: 1.35, sy: 0.8 }, { x: -1.0, y: 3.5 * tall, z: -0.5, r: 1.4, sy: 0.8 }];
      const o = { cells, seed, height: 5.6 * tall, sway: 0.02, depthDark: 0.5 };
      return { conifer: false, geo: [
        canopy(P, { ...o, size: 1.75, cover: 1.5 }),
        canopy(P, { ...o, size: 2.2, cover: 1.1, core: false }),
        canopy(P.slice(0, 2), { ...o, size: 2.7, cover: 1.0, core: false }),
      ] };
    };
    const cone = (cell: LeafCell, seed: number): Kind => {
      const o = { cell, seed, base: 1.2, top: 7.4, radius: 1.9 };
      return { conifer: true, geo: [
        conifer({ ...o, tiers: 5, detail: 0.45, size: 1.1 }),
        conifer({ ...o, tiers: 4, detail: 0.32, size: 1.25, core: false }),
        conifer({ ...o, tiers: 3, detail: 0.26, size: 1.4, core: false }),
      ] };
    };
    const kinds: Kind[] = [broad(['oak', 'oak', 'oakFresh'], 1), broad(['oakFresh', 'oak'], 2, 1.1), broad(['maple', 'oak'], 3), broad(['birch', 'oakFresh'], 4, 1.15), cone('fir', 5), cone('pine', 6)];
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.6, 5, 1, true).translate(0, 1.8, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ map: tex('bark_spruce', { repeat: true }), color: 0x8a7a68, roughness: 1 });
    // three belts: dense near the clearing, sparser and bigger towards the horizon
    const belts = quality === 'high'
      ? [{ r0: 0, r1: 62, step: 3.6, s: [0.9, 1.25] }, { r0: 62, r1: 135, step: 5.6, s: [1.15, 1.6] }, { r0: 135, r1: 205, step: 9, s: [1.6, 2.3] }]
      : [{ r0: 0, r1: 62, step: 4.4, s: [0.95, 1.3] }, { r0: 62, r1: 135, step: 7.2, s: [1.25, 1.7] }, { r0: 135, r1: 200, step: 12, s: [1.8, 2.5] }];
    // instances binned by kind, belt and sector (so the sectors off screen are culled)
    const SECT = 3;
    const bins = new Map<string, { x: number; y: number; z: number; s: number; yaw: number; kind: number }[]>();
    belts.forEach((b, band) => {
      const lim = b.r1;
      for (let gz = -lim; gz < lim; gz += b.step) for (let gx = -lim; gx < lim; gx += b.step) {
        const x = gx + r.range(0, b.step), z = gz + r.range(0, b.step);
        const d = Math.hypot(x, z);
        const inner = Math.max(Math.abs(x), Math.abs(z)) < HALF + 0.5;
        if (d < b.r0 || d >= b.r1 || inner) continue;
        if (inViewWedge(x, z) && d < 75) continue;
        // clearings and glades in the far woods
        if (fbm(x / 26, 3, z / 26, SEED) < 0.3 && d > 40) continue;
        if (band === 0 && r.chance(0.08)) continue;
        const k = r();
        // conifers climb the valley sides, broadleaves fill the floor
        const kind = k < 0.25 + Math.min(0.4, d / 400) ? r.pick([4, 5, 4]) : r.pick([0, 0, 1, 2, 3]);
        const sect = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * SECT) % SECT;
        const key = `${kind}:${sect}:${band}`;
        if (!bins.has(key)) bins.set(key, []);
        bins.get(key)!.push({ x, y: outerY(x, z) - 0.15, z, s: r.range(b.s[0], b.s[1]), yaw: r.range(0, Math.PI * 2), kind });
      }
    });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sv = new THREE.Vector3();
    for (const [key, list] of bins) {
      const kind = kinds[+key.split(':')[0]];
      const band = +key.split(':')[2];
      const geo = withLeafState(kind.geo[band], list.length);
      const mesh = new THREE.InstancedMesh(geo, leaf.mat, list.length);
      const tm = band === 0 ? new THREE.InstancedMesh(trunk, trunkMat, list.length) : null;
      list.forEach((it, i) => {
        q.setFromAxisAngle(up, it.yaw);
        m.compose(v.set(it.x, it.y, it.z), q, sv.set(it.s, it.s * (0.9 + hash(i, 1, 2) * 0.25), it.s));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, new THREE.Color(1, 1, 1).multiplyScalar(0.9 + hash(i, 7, band) * 0.16));
        tm?.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = false; mesh.receiveShadow = band === 0;
      mesh.name = `vista:${key}`;
      this.group.add(mesh);
      this.trees.push({ mesh, deciduous: !kind.conifer });
      if (tm) { tm.instanceMatrix.needsUpdate = true; tm.computeBoundingSphere(); tm.name = `vista:${key}:trunk`; this.group.add(tm); }
    }
  }

  // ---------------------------------------------------------------- hills and mountains
  private buildRidges() {
    const defs = [
      { r: 250, base: 6, amp: 30, freq: 3.2, trees: 1, haze: 0.18, body: 0x2a6448 },
      { r: 360, base: 22, amp: 62, freq: 2.2, trees: 0.6, haze: 0.36, body: 0x3a7090 },
      { r: 520, base: 40, amp: 150, freq: 1.5, trees: 0, haze: 0.55, body: 0x5a7cb8 },
    ];
    defs.forEach((d, li) => {
      const segs = 320, pos: number[] = [], top: number[] = [], side: number[] = [], idx: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const t = (k: number) => fbm(ca * d.freq + 10 + li * 5, k, sa * d.freq + 10, SEED + li);
        // ridged profile: peaks and saddles, crowns of trees on the near hills
        let h = d.base + d.amp * Math.pow(t(1), 1.6) * 1.4 + (li === 2 ? Math.pow(Math.abs(t(4) - 0.5) * 2, 2) * d.amp * 0.5 : 0);
        if (d.trees) h += (fbm(ca * 60, 2, sa * 60, SEED) - 0.4) * 2.2 + Math.abs(Math.sin(a * 500)) * 0.8;
        const slope = (t(1.02) - t(0.98)) * 10;
        const R = d.r * (1 + (t(7) - 0.5) * 0.12);
        // three rows: well below the ground, the haze line, the crest
        const rows: [number, number][] = [[-20, 0], [h * 0.45, 0.45], [h, 1]];
        for (const [y, tp] of rows) { pos.push(ca * R, y, sa * R); top.push(tp); side.push(0.5 + slope * 0.6 + (tp > 0.9 ? 0.15 : 0)); }
        if (i < segs) for (let rr = 0; rr < 2; rr++) {
          const a0 = i * 3 + rr, b0 = (i + 1) * 3 + rr;
          idx.push(a0, b0, b0 + 1, a0, b0 + 1, a0 + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
      geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const mat = new THREE.ShaderMaterial({
        vertexShader: RIDGE_VS, fragmentShader: RIDGE_FS, side: THREE.DoubleSide, fog: false,
        uniforms: { uBody: { value: new THREE.Color() }, uLit: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uSnow: { value: new THREE.Color(0xf4f6ff) }, uSnowLine: { value: li === 2 ? d.base + d.amp * 0.95 : 1e9 }, uTrees: { value: d.trees }, uTime: { value: 0 } },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `vista:ridge${li}`;
      mesh.frustumCulled = false;
      mesh.renderOrder = -5 + li;
      this.group.add(mesh);
      this.ridges.push({ mesh, mat, haze: d.haze, body: new THREE.Color(d.body), trees: d.trees });
    });
  }

  /** Colour the far hills and the valley floor from the sky (aerial perspective follows the time of day). */
  setSky(sky: Sky) {
    const hor = sky.horizon, fog = sky.fog.color, sun = sky.sun.color, night = sky.night;
    const tmp = new THREE.Color();
    for (const r of this.ridges) {
      const U = r.mat.uniforms;
      // the ridge's own colour lit by the sky, sunk into the haze by its distance
      const body = tmp.copy(r.body).multiply(new THREE.Color().copy(sky.hemi.color).lerp(new THREE.Color(1, 1, 1), 0.45)).multiplyScalar(0.75 + 0.35 * (1 - night));
      (U.uBody.value as THREE.Color).copy(body).lerp(fog, r.haze);
      (U.uLit.value as THREE.Color).copy(body).lerp(sun, 0.18 * (1 - night)).multiplyScalar(1.12).lerp(fog, r.haze * 0.9);
      (U.uHaze.value as THREE.Color).copy(fog).lerp(hor, 0.5);
      (U.uSnow.value as THREE.Color).setRGB(0.95, 0.96, 1).multiply(new THREE.Color().copy(sun).lerp(new THREE.Color(1, 1, 1), 0.5)).multiplyScalar(night > 0.5 ? 0.38 : 1.05).lerp(fog, r.haze * 0.5);
    }
    void this.groundMat;
  }

  /** Dress the far woods for the season (autumn colours on some broadleaves, bare winter broadleaves). */
  setSeason(info: SeasonInfo) {
    const turned = info.season === 'autumn' ? 0.3 + 0.35 * info.t : 0;
    for (const t of this.trees) {
      const a = t.mesh.geometry.getAttribute('iLeaf') as THREE.InstancedBufferAttribute;
      for (let i = 0; i < t.mesh.count; i++) {
        let st = 0;
        if (t.deciduous && info.season === 'winter') st = -1;
        else if (t.deciduous && hash(i, 31, t.mesh.id) < turned) st = 1;
        a.setX(i, st);
      }
      a.needsUpdate = true;
    }
  }

  update(t: number, _camera: THREE.Camera) { for (const r of this.ridges) r.mat.uniforms.uTime.value = t; }
}
