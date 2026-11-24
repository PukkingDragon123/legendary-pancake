// The oak's small greenery: hand-pixelled leaf cards (public/models/house/tex/leaves.webp, made by
// art/lowpix/house/tex.py) for the ivy that climbs the bark, the ferns in the moss round the foot and the sprigs in
// the flower boxes. Flat cards keep their orientation; camera-facing ('bill') cards are kept for small clumps. They
// sway in the shared wind and glow a little where the sun comes through them. (The crown itself is built with the
// forest's shared leaf-card canopy, src/world/foliage.ts, so the oak matches the woods round it.)
import * as THREE from 'three';
import { PX, wind } from '../../gfx/box.ts';
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

/** a leaf mass: centre and radii (px); a core is the crown's dense middle */
export interface Mass { c: V3; r: V3; core?: boolean; tint?: V3 }
