// The boutique's greenery, built the way the forest is: from 2D detailed pixel-art leaf cards. A small
// hand-pixelled atlas (fir sprigs, a split monstera leaf, a young monstera leaf, a variegated pothos
// vine) is cut out on alpha-tested quads, many per plant, lit by the shop's lamps, and the whole plant
// stirs a little in the stove's warm draught. Pots are low-poly lathes with a pixel terracotta glaze.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { P } from '../../gfx/palette.ts';
import { rng } from '../../gfx/noise.ts';
import { Pix } from './shopart.ts';

const CELL = 64, COLS = 4, ROWS = 2;
/** atlas cells */
export const LEAF = { firA: 0, firB: 1, monstera: 2, monsteraYoung: 3, pothos: 4, firOrn: 5 } as const;

// ------------------------------------------------------------------ painting the leaves

function firSprig(p: Pix, ox: number, oy: number, seed: number, ornament = false) {
  const r = rng(seed);
  const greens = [P.forest, P.pine, P.leaf, P.fern];
  // the twig curls a little as it grows up the cell
  const twig = (t: number) => ({ x: ox + 32 + Math.sin(t * 2.2 + seed) * 3 * t, y: oy + 62 - t * 58 });
  for (let i = 0; i <= 58; i++) { const q = twig(i / 58); p.set(q.x, q.y, P.bark); if (i < 30) p.set(q.x + 1, q.y, P.barkDark); }
  for (let i = 2; i < 58; i += 2) {
    const t = i / 58, q = twig(t), len = 4 + (1 - t) * 7 + r() * 2;
    for (const sd of [-1, 1]) {
      const ang = (-Math.PI / 2) + sd * (0.95 + r() * 0.25);
      for (let k = 1; k <= len; k++) {
        const x = q.x + Math.cos(ang) * k, y = q.y + Math.sin(ang) * k + k * 0.18;
        const tip = k > len - 2, under = sd > 0 && k > 2;
        p.set(x, y, tip ? (r() < 0.5 ? P.sage : P.moss) : under ? greens[Math.floor(r() * 2)] : greens[1 + Math.floor(r() * 3)]);
      }
    }
    // a few needles pointing at the viewer, as dots along the twig
    if (r() < 0.5) p.set(q.x + (r() - 0.5) * 2, q.y, P.fern);
  }
  p.set(twig(1).x, twig(1).y - 1, P.sageLight); p.set(twig(1).x, twig(1).y - 2, P.sage);
  if (ornament) {
    // a little honey-glass bauble with a brass cap hanging from the sprig
    const q = twig(0.45);
    p.set(q.x + 8, q.y + 1, P.brassDark); p.set(q.x + 8, q.y + 2, P.brass);
    p.disc(q.x + 8, q.y + 5, 2.6, P.berry); p.set(q.x + 7, q.y + 4, P.blush); p.set(q.x + 8, q.y + 6, P.plum);
  }
}

function monsteraLeaf(p: Pix, ox: number, oy: number, slits: boolean) {
  // leaf-local: u along the midrib (0 at the stem, 1 at the tip), v across (-1 left .. 1 right)
  const L = 56, cx = ox + 32, base = oy + 60;
  const width = (u: number) => (u < 0.18 ? 0.62 + u * 1.6 : Math.pow(Math.sin(Math.PI * Math.min(1, (u - 0.02) * 1.02)), 0.55) * (1 - 0.25 * u)) * 26;
  const slitAt = [0.3, 0.45, 0.6, 0.74];
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const px = ox + x, py = oy + y, u = (base - py) / L;
    if (u < 0 || u > 1) continue;
    const w = width(u), v = (px + 0.5 - cx) / Math.max(1, w);
    if (Math.abs(v) > 1) continue;
    // the heart notch at the base
    if (u < 0.1 && Math.abs(v) < 0.25 * (1 - u * 10)) continue;
    // fenestration: slits running in from the edge, angled towards the tip
    let hole = false;
    if (slits && Math.abs(v) > 0.38) for (const s of slitAt) if (Math.abs(u - s - (Math.abs(v) - 0.38) * 0.22) < 0.018) hole = true;
    if (slits && Math.abs(v) > 0.3 && Math.abs(v) < 0.5 && Math.abs(u - 0.52) < 0.03) hole = true;
    if (hole) continue;
    const edge = Math.abs(v) > 0.9 || u > 0.96;
    const vein = slitAt.some((s) => Math.abs(u - s - Math.abs(v) * 0.22 + 0.04) < 0.012) && Math.abs(v) > 0.08;
    const mid = Math.abs(px + 0.5 - cx) < 1.1;
    const lit = v < 0;
    p.set(px, py, edge ? P.forest : mid ? P.sage : vein ? (lit ? P.fern : P.leaf) : lit ? (((px + py) % 7 === 0) ? P.moss : P.fern) : ((px * 3 + py) % 9 === 0 ? P.fern : P.leaf));
  }
  // the petiole into the cell's bottom edge
  for (let y = base; y < oy + CELL; y++) { p.set(cx, y, P.fern); p.set(cx + 1, y, P.leaf); }
}

function pothosVine(p: Pix, ox: number, oy: number, seed: number) {
  const r = rng(seed);
  const vine = (t: number) => ({ x: ox + 32 + Math.sin(t * 5 + seed) * 6, y: oy + 2 + t * 60 });
  for (let i = 0; i <= 60; i++) { const q = vine(i / 60); p.set(q.x, q.y, P.fern); }
  for (let k = 0; k < 5; k++) {
    const t = 0.1 + k * 0.19, q = vine(t), sd = k % 2 ? 1 : -1;
    const lx = q.x + sd * 7, ly = q.y + 2, s = 5.5 + r() * 1.5;
    for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) {
      // a little heart, pointing down and out
      const a = x * sd, b = y;
      const heart = (a * a) / (s * s) + ((b - Math.abs(a) * 0.35) ** 2) / (s * s * 0.9) < 1;
      if (!heart) continue;
      const edge = (a * a) / (s * s) + ((b - Math.abs(a) * 0.35) ** 2) / (s * s * 0.9) > 0.72;
      const streak = (x + y * 2 + k) % 5 === 0 && !edge;
      p.set(lx + x, ly + y, edge ? P.pine : streak ? P.cream : x * sd < 0 ? P.moss : P.fern);
    }
    for (let i = 0; i < 7; i++) p.set(q.x + (sd * i), q.y + i * 0.3, P.fern);
  }
}

let atlas: THREE.CanvasTexture | null = null;
function leafAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const p = new Pix(CELL * COLS, CELL * ROWS);
  const at = (i: number) => [(i % COLS) * CELL, Math.floor(i / COLS) * CELL] as const;
  firSprig(p, ...at(LEAF.firA), 3);
  firSprig(p, ...at(LEAF.firB), 11);
  monsteraLeaf(p, ...at(LEAF.monstera), true);
  monsteraLeaf(p, ...at(LEAF.monsteraYoung), false);
  pothosVine(p, ...at(LEAF.pothos), 5);
  firSprig(p, ...at(LEAF.firOrn), 17, true);
  atlas = p.texture();
  atlas.minFilter = THREE.NearestMipmapLinearFilter; atlas.generateMipmaps = true;
  return atlas;
}

// ------------------------------------------------------------------ building plants

/** A leaf card: a quad of `w` x `h` metres showing atlas cell `cell`, its base at the origin, growing up +y. */
function card(cell: number, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const cx = (cell % COLS) / COLS, cy = 1 - (Math.floor(cell / COLS) + 1) / ROWS;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) / COLS, cy + uv.getY(i) / ROWS);
  return g;
}
/** Place a card: base at `at`, pointing along `dir` (its +y), turned about that axis by `roll`. */
function placed(g: THREE.BufferGeometry, at: THREE.Vector3, dir: THREE.Vector3, roll: number): THREE.BufferGeometry {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll);
  g.applyQuaternion(r).applyQuaternion(q).translate(at.x, at.y, at.z);
  return g;
}

let potTex: THREE.CanvasTexture | null = null;
function potTexture(): THREE.CanvasTexture {
  if (potTex) return potTex;
  const p = new Pix(32, 32), r = rng(9);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const band = y < 6 ? P.clay : y === 6 ? P.woodDark : y > 28 ? P.clay : P.terracotta;
    p.set(x, y, r() < 0.08 ? P.clay : r() < 0.05 ? P.rose : band);
  }
  for (let x = 0; x < 32; x += 8) { p.set(x + 3, 14, P.cream); p.set(x + 4, 15, P.cream); p.set(x + 3, 16, P.cream); }
  potTex = p.texture();
  potTex.wrapS = THREE.RepeatWrapping;
  return potTex;
}
function pot(r: number, h: number): THREE.Mesh {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.72, 0), new THREE.Vector2(r * 0.86, h * 0.6), new THREE.Vector2(r, h * 0.84), new THREE.Vector2(r * 1.04, h), new THREE.Vector2(r * 0.9, h), new THREE.Vector2(r * 0.86, h * 0.92), new THREE.Vector2(0, h * 0.92)];
  const g = new THREE.LatheGeometry(pts, 12);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: potTexture(), roughness: 0.9 }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const swayUniform = { value: 0 };
function leafMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSway = swayUniform;
    sh.vertexShader = 'uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float reach = length(position.xz) + max(0.0, position.y - 0.3) * 0.25;
      transformed.x += sin(uSway * 1.3 + position.y * 5.0 + position.z * 3.0) * 0.012 * reach;
      transformed.z += cos(uSway * 1.1 + position.y * 4.0 + position.x * 3.0) * 0.008 * reach;`);
  };
  return m;
}

/** Advance the plants' gentle sway (call each frame). */
export function swayPlants(t: number) { swayUniform.value = t; }

export interface Plant { group: THREE.Group; dispose(): void }
function assemble(cards: THREE.BufferGeometry[], extra: THREE.Object3D[]): Plant {
  const group = new THREE.Group();
  const geo = mergeGeometries(cards)!;
  cards.forEach((c) => c.dispose());
  const mat = leafMaterial();
  const leaves = new THREE.Mesh(geo, mat);
  leaves.castShadow = true; leaves.receiveShadow = true;
  group.add(leaves, ...extra);
  return { group, dispose: () => { geo.dispose(); mat.dispose(); for (const e of extra) { (e as THREE.Mesh).geometry?.dispose(); } } };
}

/** A potted fir, about `h` metres tall: tiers of sprig cards around a trunk, with a few baubles. */
export function pottedFir(h = 1.9): Plant {
  const r = rng(41), cards: THREE.BufferGeometry[] = [];
  const potH = h * 0.2, potR = h * 0.14;
  const tiers = 9;
  for (let k = 0; k < tiers; k++) {
    const f = k / (tiers - 1), y = potH + 0.08 + f * (h - potH - 0.2), reach = (1 - f * 0.85) * h * 0.3 + 0.05;
    const n = Math.round(9 - f * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.7 + r() * 0.3;
      const out = new THREE.Vector3(Math.cos(a), -0.25 - r() * 0.2 + f * 0.15, Math.sin(a));
      const cell = r() < 0.12 ? LEAF.firOrn : r() < 0.5 ? LEAF.firA : LEAF.firB;
      cards.push(placed(card(cell, reach * 0.95, reach * 1.05), new THREE.Vector3(Math.cos(a) * 0.03, y, Math.sin(a) * 0.03), out, r() * Math.PI));
      cards.push(placed(card(cell, reach * 0.8, reach * 0.95), new THREE.Vector3(Math.cos(a) * 0.03, y + 0.02, Math.sin(a) * 0.03), out, r() * Math.PI + Math.PI / 2));
    }
  }
  // the leader at the top
  cards.push(placed(card(LEAF.firA, 0.18, 0.28), new THREE.Vector3(0, h - 0.26, 0), new THREE.Vector3(0, 1, 0), 0));
  cards.push(placed(card(LEAF.firA, 0.18, 0.28), new THREE.Vector3(0, h - 0.26, 0), new THREE.Vector3(0, 1, 0), Math.PI / 2));
  const p = pot(potR, potH);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, h - potH, 6), new THREE.MeshStandardMaterial({ color: P.bark, roughness: 1 }));
  trunk.position.y = potH + (h - potH) / 2 - 0.05;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(potR * 0.86, 12), new THREE.MeshStandardMaterial({ color: P.barkDark, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = potH * 0.9;
  return assemble(cards, [p, trunk, soil]);
}

/** A potted monstera: split leaves on long stalks fanning out of a glazed pot. */
export function pottedMonstera(h = 1.2): Plant {
  const r = rng(7), cards: THREE.BufferGeometry[] = [], stems: THREE.BufferGeometry[] = [];
  const potH = h * 0.27, potR = h * 0.17;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4, lift = 0.45 + r() * 0.5, len = h * (0.35 + r() * 0.32);
    const dir = new THREE.Vector3(Math.cos(a) * (1 - lift * 0.6), lift + 0.4, Math.sin(a) * (1 - lift * 0.6)).normalize();
    const tip = new THREE.Vector3(0, potH * 0.95, 0).addScaledVector(dir, len);
    const stem = new THREE.CylinderGeometry(0.008, 0.012, len, 4);
    stem.translate(0, len / 2, 0);
    stems.push(placed(stem, new THREE.Vector3(0, potH * 0.95, 0), dir, 0));
    const leafDir = new THREE.Vector3(Math.cos(a), 0.35 + r() * 0.4, Math.sin(a)).normalize();
    const size = h * (0.32 + r() * 0.12);
    cards.push(placed(card(r() < 0.25 ? LEAF.monsteraYoung : LEAF.monstera, size, size), tip, leafDir, Math.PI / 2 + (r() - 0.5) * 0.6));
  }
  const sg = mergeGeometries(stems)!;
  stems.forEach((s) => s.dispose());
  const stemMesh = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: P.fern, roughness: 0.9 }));
  return assemble(cards, [pot(potR, potH), stemMesh]);
}

/** A small potted pothos whose vines trail down over the edge it stands on. */
export function trailingPothos(drop = 0.9): Plant {
  const r = rng(23), cards: THREE.BufferGeometry[] = [];
  const potH = 0.16, potR = 0.1;
  // a crown of leaves
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; cards.push(placed(card(LEAF.pothos, 0.16, 0.2), new THREE.Vector3(0, potH, 0), new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)), r() * Math.PI)); }
  // vines hanging down the front, each a chain of cards
  for (let v = 0; v < 5; v++) {
    const x = (v - 2) * 0.07, segs = Math.round((drop * (0.5 + r() * 0.5)) / 0.18);
    for (let k = 0; k < segs; k++) {
      const at = new THREE.Vector3(x + Math.sin(k + v) * 0.02, potH - 0.02 - k * 0.18, 0.12 + k * 0.01);
      cards.push(placed(card(LEAF.pothos, 0.14, 0.2), at, new THREE.Vector3(0, -1, 0.08), (r() - 0.5) * 0.5));
    }
  }
  return assemble(cards, [pot(potR, potH)]);
}
