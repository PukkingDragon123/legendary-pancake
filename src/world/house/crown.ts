// The oak's leaves: a huge, dense crown of hand-pixelled oak-leaf cluster cards (public/models/house/tex/leaves.webp,
// made by art/lowpix/house/tex.py), plus the ivy, ferns and sprigs that grow on and round the trunk.
//
// Crown cards face the camera (and the sun in the shadow pass, so they cast full dappled shadows) and carry a
// normal bent outward from the middle of their leaf mass, so the crown lights like one big bushy volume: sunlit
// tops, a dark heart and underside. Deep shells of darker clusters fill the inside (no sky through the gaps), sprays
// and twiglets break the outline, everything sways in the shared wind, and leaves glow a little where the light
// comes through them. Ivy and ferns are flat cards that hug the bark or stand in the moss.
import * as THREE from 'three';
import { PX, wind } from '../../gfx/box.ts';
import { rng } from '../../gfx/noise.ts';
import type { V3 } from './geo.ts';
import { houseTex, patchCut } from './kit.ts';

/** atlas cells (8 x 4 of 128 px): row 0 dense clusters, row 1 sprays, row 2 acorn sprigs + hanging, row 3 ivy, ferns, twigs, deep */
export const CELL = {
  dense: [0, 1, 2, 3, 4, 5, 6, 7], spray: [8, 9, 10, 11, 12, 13, 14, 15], acorn: [16, 17, 18, 19], hang: [20, 21, 22, 23],
  ivy: [24, 25], fern: [26, 27], twig: [28, 29], deep: [30, 31],
};
function cellUV(c: number): [number, number, number, number] {
  const col = c % 8, row = Math.floor(c / 8);
  const e = 0.5 / 1024;
  return [col / 8 + e, 1 - (row + 1) / 4 + e * 2, (col + 1) / 8 - e, 1 - row / 4 - e * 2];
}

/** Lights the leaves like leaves: sun through the edges, a touch of sky in the shade. */
export const LEAF = {
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
  uSunCol: { value: new THREE.Color(1, 0.9, 0.7) },
  uTransl: { value: 0.35 },
};

const mats: Partial<Record<'bill' | 'flat', THREE.MeshStandardMaterial>> = {};

/** The leaf-card material: 'bill' cards face the camera (crown), 'flat' cards keep their orientation (ivy, ferns). */
export function leafMat(kind: 'bill' | 'flat'): THREE.MeshStandardMaterial {
  if (mats[kind]) return mats[kind]!;
  const m = new THREE.MeshStandardMaterial({ map: houseTex('leaves'), alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.78, metalness: 0 });
  m.name = 'house:leaves:' + kind;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.uniforms.uWind = wind.uWind;
    Object.assign(sh.uniforms, LEAF);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform vec3 uWind;
attribute vec4 aCard;${kind === 'bill' ? '\nattribute vec2 aCorner;' : ''}
varying float vEdge;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  float ph = position.x * 0.021 + position.z * 0.017 + position.y * 0.013;
  float g = 0.6 + uWind.z * 6.0;
  float s = sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.3;
  transformed += vec3(s * 1.6, s * 0.5, cos(uTime * 1.25 + ph) * 1.1) * aCard.z * g;
  ${kind === 'bill' ? `
  float c = cos(aCard.y), sn = sin(aCard.y);
  vec2 off = vec2(c * aCorner.x - sn * aCorner.y, sn * aCorner.x + c * aCorner.y) * aCard.x;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  transformed += camR * off.x + camU * off.y;` : ''}
}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vEdge = aCard.w;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTransl;
varying float vEdge;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  // light shining through: strongest looking towards the sun, on the outer cards
  vec3 V = normalize(vViewPosition);
  vec3 Ls = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float through = pow(max(0.0, dot(-V, Ls)), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * uSunCol * uTransl * (0.35 + through * 1.6) * vEdge;
}`);
  };
  m.customProgramCacheKey = () => 'hhleaf:' + kind;
  patchCut(m);
  mats[kind] = m;
  return m;
}

/** Shadow-pass material for leaf cards: the same cut-outs (and for the crown, facing the light). */
function leafDepth(kind: 'bill' | 'flat'): THREE.MeshDepthMaterial {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: houseTex('leaves'), alphaTest: 0.42, side: THREE.DoubleSide });
  d.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.uniforms.uWind = wind.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform vec3 uWind;
attribute vec4 aCard;${kind === 'bill' ? '\nattribute vec2 aCorner;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  float ph = position.x * 0.021 + position.z * 0.017 + position.y * 0.013;
  float g = 0.6 + uWind.z * 6.0;
  float s = sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.3;
  transformed += vec3(s * 1.6, s * 0.5, cos(uTime * 1.25 + ph) * 1.1) * aCard.z * g;
  ${kind === 'bill' ? `
  float c = cos(aCard.y), sn = sin(aCard.y);
  vec2 off = vec2(c * aCorner.x - sn * aCorner.y, sn * aCorner.x + c * aCorner.y) * aCard.x;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  transformed += camR * off.x + camU * off.y;` : ''}
}`);
  };
  d.customProgramCacheKey = () => 'hhleafdepth:' + kind;
  return d;
}

/** Builds a batch of leaf cards (house px). */
export class Cards {
  private pos: number[] = []; private nor: number[] = []; private uv: number[] = []; private col: number[] = [];
  private card: number[] = []; private corner: number[] = []; private idx: number[] = [];
  constructor(readonly kind: 'bill' | 'flat') {}

  get size() { return this.idx.length / 6; }

  /** A camera-facing card at c (px), size s (px), atlas cell, roll, outward normal n, tint, sway amount, edge glow. */
  bill(c: V3, s: number, cell: number, roll: number, n: V3, tint: V3, sway = 1, edge = 0.5, flipX = false) {
    const [u0, v0, u1, v1] = cellUV(cell);
    const b = this.pos.length / 3;
    const cs: [number, number][] = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    for (const [x, y] of cs) {
      this.pos.push(c[0], c[1], c[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(((x > 0) !== flipX) ? u1 : u0, y > 0 ? v1 : v0);
      this.col.push(tint[0], tint[1], tint[2]);
      this.card.push(s, roll, sway, edge);
      this.corner.push(x, y);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /** A flat card from its four corners (bl, br, tr, tl; px), with the given normal. */
  flat(q: [V3, V3, V3, V3], cell: number, n: V3, tint: V3, sway = 0.4, edge = 0.3, vFrom = 0, vTo = 1) {
    const [u0, v0, u1, v1] = cellUV(cell);
    const vv = (t: number) => v0 + (v1 - v0) * t;
    const b = this.pos.length / 3;
    const uvs: [number, number][] = [[u0, vv(vFrom)], [u1, vv(vFrom)], [u1, vv(vTo)], [u0, vv(vTo)]];
    q.forEach((p, i) => {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(tint[0], tint[1], tint[2]);
      // sway grows towards the top of a standing card
      this.card.push(0, 0, i >= 2 ? sway : sway * 0.15, edge);
      this.corner.push(0, 0);
    });
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  mesh(name: string): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aCard', new THREE.Float32BufferAttribute(this.card, 4));
    if (this.kind === 'bill') g.setAttribute('aCorner', new THREE.Float32BufferAttribute(this.corner, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    if (g.boundingSphere) g.boundingSphere.radius += 40;
    const m = new THREE.Mesh(g, leafMat(this.kind));
    m.customDepthMaterial = leafDepth(this.kind);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = name;
    m.scale.setScalar(PX);
    return m;
  }
}

// ------------------------------------------------------------------ the crown

/** a leaf mass: centre and radii (px); a core only gets the deep dark shells that fill the crown's middle */
export interface Mass { c: V3; r: V3; core?: boolean; tint?: V3 }

const GREEN_TINTS: V3[] = [[1, 1, 1], [0.92, 1.02, 0.86], [1.06, 1.04, 0.84], [0.86, 0.96, 0.92], [1.1, 1.08, 0.8]];

/**
 * Fill leaf masses (ellipsoids, house px) with cards. Each mass gets: a deep core of dark dense clusters, a middle
 * shell, and an outer skin of clusters, sprays and twiglets; the normals bend out from the crown's centre (k) and
 * the mass's own centre, so the whole canopy reads as a lit volume with lobes.
 */
export function fillCrown(cards: Cards, masses: Mass[], centre: V3, seed = 3) {
  const R = rng(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let mi = 0; mi < masses.length; mi++) {
    const { c, r } = masses[mi];
    const area = 4 * Math.PI * Math.pow((Math.pow(r[0] * r[1], 1.6) + Math.pow(r[0] * r[2], 1.6) + Math.pow(r[1] * r[2], 1.6)) / 3, 1 / 1.6);
    const shells: { k0: number; k1: number; dens: number; cells: number[]; size: [number, number]; ao: number; edge: number }[] = [
      { k0: 0.35, k1: 0.6, dens: 3000, cells: CELL.deep.concat(CELL.dense), size: [64, 84], ao: 0.42, edge: 0.05 },
      { k0: 0.66, k1: 0.86, dens: 1500, cells: CELL.dense, size: [56, 72], ao: 0.62, edge: 0.15 },
      { k0: 0.92, k1: 1.06, dens: 470, cells: CELL.dense.concat(CELL.dense, CELL.spray, CELL.acorn), size: [38, 52], ao: 0.92, edge: 0.6 },
      { k0: 1.04, k1: 1.16, dens: 2000, cells: CELL.spray.concat(CELL.twig, CELL.hang), size: [36, 46], ao: 1, edge: 0.9 },
    ];
    for (let si = 0; si < shells.length; si++) {
      const sh = shells[si];
      if (masses[mi].core ? si >= 2 : si === 0) continue;
      const n = Math.max(6, Math.round(area / sh.dens));
      for (let i = 0; i < n; i++) {
        const yy = 1 - (2 * (i + 0.5)) / n;
        const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
        const th = golden * i + mi * 1.3 + si * 0.7;
        let nx = Math.cos(th) * rr, ny = yy, nz = Math.sin(th) * rr;
        // fewer cards on the underside's outer skin; what hangs there are drooping clusters
        if (si === 2 && ny < -0.45 && R() < 0.45) continue;
        const under = si === 3 && ny < -0.35;
        const k = sh.k0 + (sh.k1 - sh.k0) * R();
        const jit = 0.12;
        nx += (R() - 0.5) * jit; ny += (R() - 0.5) * jit; nz += (R() - 0.5) * jit;
        const p: V3 = [c[0] + nx * r[0] * k, c[1] + ny * r[1] * k, c[2] + nz * r[2] * k];
        // normal: out of the mass, bent towards out of the whole crown
        const gx = p[0] - centre[0], gy = (p[1] - centre[1]) * 1.6, gz = p[2] - centre[2];
        const gl = Math.hypot(gx, gy, gz) || 1;
        let qx = nx * 0.55 + (gx / gl) * 0.45, qy = ny * 0.55 + (gy / gl) * 0.45 + 0.08, qz = nz * 0.55 + (gz / gl) * 0.45;
        const ql = Math.hypot(qx, qy, qz) || 1;
        qx /= ql; qy /= ql; qz /= ql;
        const cell = under ? CELL.hang[Math.floor(R() * 4)] : sh.cells[Math.floor(R() * sh.cells.length)];
        const size = sh.size[0] + (sh.size[1] - sh.size[0]) * R();
        // hanging clusters droop: keep them upright; others roll freely
        const roll = CELL.hang.includes(cell) || CELL.twig.includes(cell) ? (R() - 0.5) * 0.8 + (CELL.twig.includes(cell) ? Math.atan2(-nx, ny) * 0.6 : 0) : R() * Math.PI * 2;
        // lower and inner cards darker (ambient occlusion), the sunny top a touch warmer
        const lowK = Math.min(1, Math.max(0, 0.75 + ny * 0.35));
        // shade under the lobes above (crevices between lobes read as depth)
        let occ = 1;
        for (let mj = 0; mj < masses.length; mj++) {
          if (mj === mi || masses[mj].core) continue;
          const o = masses[mj];
          if (o.c[1] < p[1] + 10) continue;
          const dx = (p[0] - o.c[0]) / o.r[0], dz = (p[2] - o.c[2]) / o.r[2];
          const d2 = dx * dx + dz * dz;
          if (d2 < 1) occ *= 0.82 + 0.18 * d2;
        }
        const ao = sh.ao * (0.7 + 0.3 * lowK) * Math.max(0.55, occ);
        const tint = GREEN_TINTS[Math.floor(R() * GREEN_TINTS.length)], mt = masses[mi].tint ?? [1, 1, 1];
        const warm = ny > 0.5 && si >= 2 ? 1.08 : 1;
        if (under) p[1] -= r[1] * 0.18;
        cards.bill(p, size, cell, roll, [qx, qy, qz], [tint[0] * mt[0] * ao * warm, tint[1] * mt[1] * ao * warm, tint[2] * mt[2] * ao], si >= 2 ? 1 : 0.5, sh.edge * (0.6 + 0.4 * Math.max(0, ny + 0.3)), R() < 0.5);
      }
    }
  }
}
