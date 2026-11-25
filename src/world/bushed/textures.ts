// [world3] Borrowed from BUSHED (the owner's lumberjack game, src/trees/textures.ts): the foliage atlas layout.
// The bark and foliage images themselves are Poly Haven CC0 scans re-made by BUSHED's tools/forest, recoloured
// to Hoot Hollow's calm palette and stored as WebP in public/textures/bushed/ (see docs/credits/world3.md).
import * as THREE from 'three';
import type { SpeciesId } from './species.ts';

export const ATLAS = { cols: 2, rows: 4, w: 512, h: 512 };

/** cell index -> uv rect [u0, v0, u1, v1] (three.js flips images, so v grows upward) */
export function cellRect(i: number): [number, number, number, number] {
  const c = i % ATLAS.cols, r = Math.floor(i / ATLAS.cols);
  const u0 = c / ATLAS.cols, u1 = (c + 1) / ATLAS.cols;
  const v1 = 1 - r / ATLAS.rows, v0 = 1 - (r + 1) / ATLAS.rows;
  const pu = 0.5 / ATLAS.w, pv = 0.5 / ATLAS.h;
  return [u0 + pu, v0 + pv, u1 - pu, v1 - pv];
}

/** what each atlas cell holds, per species (see BUSHED tools/forest/foliage.py) */
export interface CellSet { live: number[]; tip: number[]; inner: number[]; pendant: number[]; cones: number[]; dead: number[]; lichen: number[] }
export const CELLS: Record<SpeciesId, CellSet> = {
  spruce: { live: [0, 1, 2], tip: [2], inner: [3], pendant: [4], cones: [5], dead: [6], lichen: [7] },
  fir: { live: [0, 1, 4], tip: [2], inner: [3], pendant: [0], cones: [5], dead: [6], lichen: [7] },
  pine: { live: [0, 1, 2, 4], tip: [3], inner: [3], pendant: [2], cones: [5], dead: [6, 7], lichen: [6] },
  cedar: { live: [0, 1, 3, 4], tip: [2], inner: [5], pendant: [0, 1], cones: [6], dead: [6, 7], lichen: [7] },
  birch: { live: [0, 1, 4], tip: [3], inner: [2, 5], pendant: [1], cones: [5], dead: [6, 7], lichen: [6] },
  oak: { live: [0, 1, 4], tip: [3], inner: [2, 5], pendant: [1], cones: [5], dead: [6, 7], lichen: [6] },
};

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
/** A texture from public/textures/bushed (cached). */
export function tex(name: string, o: { repeat?: boolean; srgb?: boolean } = {}): THREE.Texture {
  const key = name + (o.repeat ? ':r' : '') + (o.srgb === false ? ':l' : '');
  let t = cache.get(key);
  if (!t) {
    t = loader.load(`${import.meta.env.BASE_URL}textures/bushed/${name}.webp`);
    t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // [light7] smooth filtering (no pixelated look), trilinear mipmaps and anisotropy
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 8;
    cache.set(key, t);
  }
  return t;
}
