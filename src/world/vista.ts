// [look4] The world beyond the clearing, so the diorama never shows the end of the ground: the valley floor rolling
// on to the horizon (outerY), a dense forest of bushy leaf-card trees in three belts that get sparser and larger
// with distance (all on the shared leaf atlas, lit by the same sun and sky), and three ridges of hills and
// mountains standing in aerial perspective round the whole horizon (painted in the sky's colours: blue-green
// forested hills, then paler hills, then far mountains with snowy tops, sinking into the horizon haze).
import * as THREE from 'three';
import { fbm, hash, rng } from '../gfx/noise.ts';
import type { SeasonInfo } from './astro.ts';
import { canopy, conifer, leafMaterial, leafTexture, leavesReady, withLeafState, type LeafCell } from './foliage.ts';
import { MeshBuilder, tube, v3 } from './bushed/geom.ts';
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
  private kinds: Kind2[] = [];
  private trees: Tree[][] = [[], [], []];
  private near = new THREE.Group();
  private nearTrees: { mesh: THREE.InstancedMesh; list: Tree[] }[] = [];
  private impostors: THREE.Mesh[] = [];
  private impMat!: THREE.ShaderMaterial;
  private atlas: THREE.WebGLRenderTarget | null = null;
  private tier: 'high' | 'medium' | 'low' = 'high';
  private groundMat: THREE.MeshLambertMaterial;

  constructor(_plan: ForestPlan, quality: 'low' | 'high') {
    this.group.name = 'vista';
    this.groundMat = this.buildGround(quality);
    this.buildForest(quality);
    this.buildRidges();
  }

  // ---------------------------------------------------------------- the valley floor
  private buildGround(quality: 'low' | 'high'): THREE.MeshLambertMaterial {
    // rings of vertices growing out from the clearing's border (sampled every half block, like the terrain, so the seam
    // has no cracks); fewer rings on the lighter build
    const per = 2, side = HALF * 2 * per, ring: [number, number][] = [];
    for (let i = 0; i < side; i++) ring.push([-HALF + i / per, -HALF]);
    for (let i = 0; i < side; i++) ring.push([HALF, -HALF + i / per]);
    for (let i = 0; i < side; i++) ring.push([HALF - i / per, HALF]);
    for (let i = 0; i < side; i++) ring.push([-HALF, HALF - i / per]);
    const n = ring.length, rings = quality === 'high' ? 34 : 22;
    const pos: number[] = [], col: number[] = [], uv: number[] = [], lawn: number[] = [], idx: number[] = [];
    // colours continue the clearing's ground across the seam (the terrain's tint at its border), then deepen under
    // the woods; the meadow in front of the cameras stays lawn
    const c = new THREE.Color(), edge = new THREE.Color(0.94, 1.04, 0.84), wood = new THREE.Color(0.66, 0.8, 0.56), far = new THREE.Color(0.5, 0.64, 0.46), green = new THREE.Color(0.92, 1.16, 0.8);
    const sm = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);
    for (let k = 0; k <= rings; k++) {
      const s = 1 + Math.pow(k / rings, 2.1) * 19;
      const circ = Math.min(1, (s - 1) / 2.5);
      for (let i = 0; i < n; i++) {
        const [px, pz] = ring[i];
        const l = Math.hypot(px, pz);
        const x = k === 0 ? px : THREE.MathUtils.lerp(px * s, (px / l) * HALF * 1.18 * s, circ), z = k === 0 ? pz : THREE.MathUtils.lerp(pz * s, (pz / l) * HALF * 1.18 * s, circ);
        pos.push(x, outerY(x, z), z);
        uv.push(x / 3, z / 3);
        const out = Math.max(Math.abs(x), Math.abs(z)) - HALF, d = Math.hypot(x, z);
        // the lawn: in front of the cameras, matching the clearing's front lawn at the seam
        const wedge = z > 6 ? THREE.MathUtils.clamp(((z - 7) * 1.25 + 9 - Math.abs(x)) / 5, 0, 1) : 0;
        const lw = wedge * (1 - sm(40, 90, d));
        c.copy(edge).lerp(wood, sm(2, 26, out)).lerp(far, sm(60, 200, d)).lerp(green, lw);
        const v = 0.94 + hash(i, k, 3, SEED) * 0.12;
        col.push(c.r * v, c.g * v, c.b * v);
        lawn.push(lw);
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
    geo.setAttribute('aLawn', new THREE.Float32BufferAttribute(lawn, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // the same scans as the clearing: forest floor under the woods, the moss worn as a close-cropped lawn in front
    const map = tex('forest_floor', { repeat: true }), mossT = tex('moss', { repeat: true });
    const mat = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMoss = { value: mossT };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aLawn;\nvarying float vLawn;\nvarying vec2 vWxz;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLawn = aLawn; vWxz = position.xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uMoss;\nvarying float vLawn;\nvarying vec2 vWxz;')
        .replace('#include <map_fragment>', `
          vec3 vgF = texture2D(map, vMapUv).rgb;
          vec3 vgM = texture2D(uMoss, vWxz / 2.6).rgb * vec3(1.02, 1.16, 0.74);
          diffuseColor.rgb *= mix(vgF, vgM, smoothstep(0.2, 0.8, vLawn));`);
    };
    mat.customProgramCacheKey = () => 'hh-vista-ground';
    mat.name = 'vista-ground';
    const m = new THREE.Mesh(geo, mat);
    m.name = 'vista-ground';
    m.receiveShadow = true;
    this.group.add(m);
    return mat;
  }

  // ---------------------------------------------------------------- the forest to the horizon
  /**
   * Three belts of trees round the clearing. The near belt has real leaf-card trees on the high tier; every belt also
   * has an impostor version: each tree kind is baked once (at start, from the real canopy and trunk, see bake()) into a
   * small atlas, and drawn as one camera-facing card per tree, lit by the sky with a rounded normal. All the impostors
   * of a belt are one draw call.
   */
  private buildForest(quality: 'low' | 'high') {
    const r = rng(SEED ^ 0x5eed);
    const leaf = leafMaterial();
    type Kind = { conifer: boolean; geo: THREE.BufferGeometry; bake: THREE.BufferGeometry; trunk: boolean };
    const broad = (cells: LeafCell[], seed: number, tall = 1): Kind => {
      const P = [{ x: 0, y: 4.1 * tall, z: 0, r: 1.95, sy: 0.85 }, { x: 1.15, y: 3.3 * tall, z: 0.4, r: 1.35, sy: 0.8 }, { x: -1.0, y: 3.5 * tall, z: -0.5, r: 1.4, sy: 0.8 }];
      const o = { cells, seed, height: 5.6 * tall, sway: 0.02, depthDark: 0.5 };
      return { conifer: false, trunk: true, geo: canopy(P, { ...o, size: 1.75, cover: 1.5 }), bake: canopy(P, { ...o, size: 1.35, cover: 2.2 }) };
    };
    const cone = (cell: LeafCell, seed: number): Kind => {
      const o = { cell, seed, base: 1.2, top: 7.4, radius: 1.9 };
      return { conifer: true, trunk: true, geo: conifer({ ...o, tiers: 5, detail: 0.45, size: 1.1 }), bake: conifer({ ...o, tiers: 6, detail: 0.8, size: 1.0 }) };
    };
    this.kinds = [broad(['oak', 'oak', 'oakFresh'], 1), broad(['oakFresh', 'oak'], 2, 1.1), broad(['maple', 'oak'], 3), broad(['birch', 'oakFresh'], 4, 1.15), cone('fir', 5), cone('pine', 6)];
    const kinds = this.kinds;
    // three belts: dense near the clearing, sparser and bigger towards the horizon
    const belts = quality === 'high'
      ? [{ r0: 0, r1: 62, step: 3.6, s: [0.9, 1.25] }, { r0: 62, r1: 135, step: 5.2, s: [1.15, 1.6] }, { r0: 135, r1: 215, step: 8, s: [1.5, 2.2] }]
      : [{ r0: 0, r1: 62, step: 4.0, s: [0.95, 1.3] }, { r0: 62, r1: 135, step: 6.0, s: [1.2, 1.65] }, { r0: 135, r1: 210, step: 9.5, s: [1.7, 2.4] }];
    const trees: Tree[][] = [[], [], []];
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
        trees[band].push({ x, y: outerY(x, z) - 0.15, z, s: r.range(b.s[0], b.s[1]), yaw: r.range(0, Math.PI * 2), kind, tint: 0.88 + r() * 0.2 });
      }
    });
    this.trees = trees;
    // the near belt as real trees (high tier): instanced per kind and sector so off-screen sectors are culled
    const SECT = 3;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sv = new THREE.Vector3();
    const trunk = trunkGeometry();
    const trunkMat = new THREE.MeshStandardMaterial({ map: tex('bark_spruce', { repeat: true }), vertexColors: true, roughness: 1 });
    for (let kind = 0; kind < kinds.length; kind++) for (let sect = 0; sect < SECT; sect++) {
      const list = trees[0].filter((t) => t.kind === kind && Math.floor(((Math.atan2(t.z, t.x) + Math.PI) / (Math.PI * 2)) * SECT) % SECT === sect);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(withLeafState(kinds[kind].geo, list.length), leaf.mat, list.length);
      const tm = kinds[kind].trunk ? new THREE.InstancedMesh(trunk, trunkMat, list.length) : null;
      list.forEach((it, i) => {
        q.setFromAxisAngle(up, it.yaw);
        m.compose(v.set(it.x, it.y, it.z), q, sv.set(it.s, it.s * (0.9 + hash(i, 1, 2) * 0.25), it.s));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, new THREE.Color(it.tint, it.tint, it.tint));
        tm?.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      mesh.name = `vista:near:${kind}:${sect}`;
      this.near.add(mesh);
      this.nearTrees.push({ mesh, list });
      if (tm) { tm.instanceMatrix.needsUpdate = true; tm.computeBoundingSphere(); tm.name = `vista:near:${kind}:${sect}:trunk`; this.near.add(tm); }
    }
    this.group.add(this.near);
    // impostors: one mesh per belt
    this.impMat = impostorMaterial();
    trees.forEach((list, band) => {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const pos = new Float32Array(list.length * 4), cell = new Float32Array(list.length * 3), st = new Float32Array(list.length);
      list.forEach((t, i) => {
        pos.set([t.x, t.y, t.z, t.s * (0.9 + hash(i, 4, band) * 0.2)], i * 4);
        const green = kinds[t.kind].conifer ? 8 + (t.kind - 4) : t.kind, autumn = kinds[t.kind].conifer ? green : t.kind + 4;
        cell.set([green, autumn, t.tint], i * 3);
      });
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 4));
      g.setAttribute('iCell', new THREE.InstancedBufferAttribute(cell, 3));
      g.setAttribute('iState', new THREE.InstancedBufferAttribute(st, 1));
      g.instanceCount = list.length;
      const mesh = new THREE.Mesh(g, this.impMat);
      mesh.frustumCulled = false;
      mesh.name = `vista:impostors:${band}`;
      mesh.visible = false; // until the atlas is baked
      this.group.add(mesh);
      this.impostors.push(mesh);
    });
  }

  /** Bake the impostor atlas from the real trees (once the leaf atlas has loaded). */
  bake(renderer: THREE.WebGLRenderer) {
    void leavesReady.then(() => {
      const S = 256, N = 4;
      const rt = new THREE.WebGLRenderTarget(S * N, S * N, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
      const scene = new THREE.Scene();
      const cam = new THREE.OrthographicCamera(-FRAME / 2, FRAME / 2, FRAME, 0, 0.1, 60);
      cam.position.set(0, 0, 30); cam.lookAt(0, 0, 0);
      const leafMat = bakeMaterial(leafTexture()), barkMat = bakeMaterial(null);
      const trunk = trunkGeometry();
      const prev = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      const cells: [Kind2, boolean][] = [];
      for (let k = 0; k < 4; k++) cells.push([this.kinds[k], false]);
      for (let k = 0; k < 4; k++) cells.push([this.kinds[k], true]);
      cells.push([this.kinds[4], false], [this.kinds[5], false]);
      cells.forEach(([kind, autumn], i) => {
        scene.clear();
        const lm = leafMat.clone(); lm.uniforms.map.value = leafTexture(); lm.uniforms.uAutumn.value = autumn ? 1 : 0;
        scene.add(new THREE.Mesh(kind.bake, lm));
        if (kind.trunk) scene.add(new THREE.Mesh(trunk, barkMat));
        const x = (i % N) * S, y = (N - 1 - Math.floor(i / N)) * S;
        rt.viewport.set(x, y, S, S); rt.scissor.set(x, y, S, S); rt.scissorTest = true;
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
        lm.dispose();
      });
      rt.scissorTest = false;
      renderer.setRenderTarget(prev);
      renderer.setClearColor(prevClear, prevAlpha);
      leafMat.dispose(); barkMat.dispose();
      this.impMat.uniforms.uAtlas.value = rt.texture;
      this.atlas = rt;
      this.applyTier();
    });
  }

  /** Real near trees (high) or impostors everywhere (medium, low). */
  setTier(tier: 'high' | 'medium' | 'low') { this.tier = tier; this.applyTier(); }
  private applyTier() {
    const baked = !!this.atlas;
    this.near.visible = this.tier === 'high' || !baked;
    this.impostors.forEach((m, band) => { m.visible = baked && (band > 0 || this.tier !== 'high'); });
    // the farthest belt thins out on low
    const far = this.impostors[2];
    if (far) (far.geometry as THREE.InstancedBufferGeometry).instanceCount = this.tier === 'low' ? Math.floor(this.trees[2].length * 0.6) : this.trees[2].length;
  }

  // ---------------------------------------------------------------- hills and mountains
  private buildRidges() {
    const defs = [
      { r: 250, base: 6, amp: 30, freq: 3.2, trees: 1, haze: 0.18, body: 0x2a6448 },
      { r: 360, base: 18, amp: 42, freq: 2.2, trees: 0.6, haze: 0.36, body: 0x3a7090 },
      { r: 520, base: 30, amp: 78, freq: 1.5, trees: 0, haze: 0.55, body: 0x5a7cb8 },
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
    if (this.impMat) {
      const U = this.impMat.uniforms;
      (U.uSun.value as THREE.Color).copy(sun).multiplyScalar(sky.sun.intensity);
      (U.uSky.value as THREE.Color).copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 1.35);
      (U.uGround.value as THREE.Color).copy(sky.hemi.groundColor).multiplyScalar(sky.hemi.intensity * 1.2);
      (U.uSunDir.value as THREE.Vector3).copy(sky.sunDir);
    }
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
  }

  /** Dress the far woods for the season (autumn colours on some broadleaves, bare winter broadleaves). */
  setSeason(info: SeasonInfo) {
    this.groundMat.color.setHex({ spring: 0xf6fbf0, summer: 0xffffff, autumn: 0xf6e6cc, winter: 0xe6eae6 }[info.season]); // as the clearing's ground
    const turned = info.season === 'autumn' ? 0.3 + 0.35 * info.t : 0;
    const stateOf = (t: Tree, i: number, band: number) => {
      if (this.kinds[t.kind].conifer) return 0;
      if (info.season === 'winter') return -1;
      return hash(i, 31, band) < turned ? 1 : 0;
    };
    // the near belt's real trees and every belt's impostors agree tree for tree
    const near = new Map<Tree, number>();
    this.trees[0].forEach((t, i) => near.set(t, stateOf(t, i, 0)));
    for (const nt of this.nearTrees) {
      const a = nt.mesh.geometry.getAttribute('iLeaf') as THREE.InstancedBufferAttribute;
      nt.list.forEach((t, i) => a.setX(i, near.get(t) ?? 0));
      a.needsUpdate = true;
    }
    this.impostors.forEach((m, band) => {
      const a = m.geometry.getAttribute('iState') as THREE.InstancedBufferAttribute;
      this.trees[band].forEach((t, i) => a.setX(i, stateOf(t, i, band)));
      a.needsUpdate = true;
    });
  }

  update(t: number, _camera: THREE.Camera) { for (const r of this.ridges) r.mat.uniforms.uTime.value = t; }
}

// ---------------------------------------------------------------- impostors

/** the square every tree kind is baked into (model units, base at the bottom centre) */
const FRAME = 8.4;
interface Tree { x: number; y: number; z: number; s: number; yaw: number; kind: number; tint: number }
interface Kind2 { conifer: boolean; geo: THREE.BufferGeometry; bake: THREE.BufferGeometry; trunk: boolean }

let trunkCache: THREE.BufferGeometry | null = null;
/** A properly shaped broadleaf trunk: a gently leaning, tapering bole with root flare lobes and two main limbs
 * reaching up into the crown (bark-mapped, a few hundred triangles at most). */
function trunkGeometry(): THREE.BufferGeometry {
  if (trunkCache) return trunkCache;
  const mb = new MeshBuilder();
  const col = (_i: number, s: number): [number, number, number] => { const k = 0.62 + 0.3 * s; return [k, k * 0.96, k * 0.9]; };
  const wind = (_i: number, s: number): [number, number, number, number] => [s * s * 0.08, 0, 0, 0];
  const pts = [v3(0, -0.2, 0), v3(0.02, 0.5, 0.01), v3(0.06, 1.5, -0.02), v3(0.1, 2.5, 0.02), v3(0.08, 3.5, 0.06)];
  tube(mb, pts, [0.36, 0.3, 0.24, 0.2, 0.15], { sides: 7, tile: [1.2, 1.6], col, wind, rough: 0.12, roughSeed: 3 });
  // root flare: three short lobes running into the ground
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4, o = v3(Math.cos(a), 0, Math.sin(a));
    tube(mb, [v3(0, 0.55, 0).addScaledVector(o, 0.12), v3(0, 0.18, 0).addScaledVector(o, 0.38), v3(0, -0.12, 0).addScaledVector(o, 0.66)], [0.13, 0.11, 0.05], { sides: 4, tile: [1.2, 1.6], col: () => [0.6, 0.57, 0.53], wind: () => [0, 0, 0, 0], capTip: true });
  }
  // two limbs into the crown
  for (const [a, h] of [[0.6, 2.6], [3.6, 2.9]] as const) {
    const o = v3(Math.cos(a), 0, Math.sin(a));
    tube(mb, [v3(0.08, h, 0), v3(0.08, h + 0.6, 0).addScaledVector(o, 0.45), v3(0.08, h + 1.2, 0).addScaledVector(o, 0.8)], [0.12, 0.08, 0.04], { sides: 5, tile: [1.2, 1.6], col: () => [0.8, 0.77, 0.72], wind: (_i, s) => [0.1 + s * 0.05, s * 0.1, 0, 0], capTip: true });
  }
  return (trunkCache = mb.build({ moss: false }));
}

/** Baking: the leaf card (or bark) albedo times its painted depth shading, stored as sqrt for 8-bit precision. */
function bakeMaterial(map: THREE.Texture | null): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { map: { value: map }, uAutumn: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 color; uniform float uAutumn; varying vec2 vUv; varying vec3 vCol;
      void main() { vUv = uv; if (uAutumn > 0.5 && vUv.y > 0.75) vUv.y -= 0.25; vCol = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: map ? /* glsl */ `
      uniform sampler2D map; varying vec2 vUv; varying vec3 vCol;
      void main() { vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard; gl_FragColor = vec4(sqrt(clamp(t.rgb * vCol, 0.0, 1.0)), 1.0); }` : /* glsl */ `
      varying vec2 vUv; varying vec3 vCol;
      void main() { vec3 bark = vec3(0.16, 0.12, 0.09) * vCol; gl_FragColor = vec4(sqrt(bark), 1.0); }`,
  });
}

/** The impostor cards: upright, turned to the camera, the baked tree lit by the sun and sky with a rounded normal. */
function impostorMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uAtlas: { value: null }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSky: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    }]),
    vertexShader: /* glsl */ `
      attribute vec4 iPos; attribute vec3 iCell; attribute float iState;
      varying vec2 vUv; varying vec3 vN; varying float vTint;
      #include <fog_pars_vertex>
      void main() {
        vec3 toCam = cameraPosition - iPos.xyz; toCam.y = 0.0; toCam = normalize(toCam);
        vec3 right = vec3(toCam.z, 0.0, -toCam.x);
        float s = iPos.w * ${FRAME.toFixed(2)};
        vec3 wp = iPos.xyz + right * position.x * s + vec3(0.0, position.y * s, 0.0);
        float cell = iState > 0.5 ? iCell.y : iCell.x;
        vec2 c = vec2(mod(cell, 4.0), 3.0 - floor(cell / 4.0));
        vUv = (c + vec2(position.x + 0.5, position.y)) / 4.0;
        vN = normalize(right * position.x * 1.5 + vec3(0.0, (position.y - 0.5) * 0.9, 0.0) + toCam * 0.8);
        vTint = iCell.z;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        if (iState < -0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec3 uSun; uniform vec3 uSunDir; uniform vec3 uSky; uniform vec3 uGround;
      varying vec2 vUv; varying vec3 vN; varying float vTint;
      #include <fog_pars_fragment>
      void main() {
        vec4 t = texture2D(uAtlas, vUv);
        vec2 d = vUv * 1024.0; vec2 dx = dFdx(d), dy = dFdy(d);
        float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
        if (t.a * (1.0 + lod * 0.35) < 0.5) discard;
        vec3 alb = t.rgb / max(t.a, 1e-3); alb *= alb;
        vec3 n = normalize(vN);
        float nd = max(dot(n, uSunDir), 0.0) * 0.75 + 0.25 * max(dot(n, uSunDir) + 0.5, 0.0);
        vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
        vec3 col = alb * vTint * (amb + uSun * nd) * 0.42;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}
