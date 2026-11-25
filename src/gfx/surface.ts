// [light7] Realistic surfaces: smooth texture filtering for everything the 3D views draw, and photo detail (Poly Haven
// CC0 scans) laid over painted surfaces that are generated in code (the rooms' floors and walls, the oak's boards).
//
//   smoothTexture(t)          linear magnification, trilinear mipmaps and anisotropy (once per texture)
//   smoothMaterials(root)     smoothTexture on every map of every mesh material under root (skips textures or materials
//                             flagged `userData.crisp = true`, e.g. a pixel font on a sign)
//   addDetail(mat, kind, o)   lay a tiling photo detail over a material: its normal map (relief that catches the light),
//                             a little of its brightness variation (grain, weave, grit) and roughness that follows it
//
// A detail texture packs three things into one RGB WebP (public/textures/detail/<kind>_d.webp): RG the tangent-space
// normal's x and y (OpenGL convention, z is rebuilt), B the scan's brightness around 0.5 (2.5 sigma = +-0.4).
import * as THREE from 'three';

const MAPS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap', 'specularMap', 'lightMap', 'clearcoatMap', 'sheenColorMap', 'specularColorMap', 'specularIntensityMap'] as const;

let maxAniso = 8;
/** Tell the module the renderer's anisotropy limit (optional; 8 otherwise). */
export function setMaxAnisotropy(r: THREE.WebGLRenderer) { maxAniso = Math.min(8, r.capabilities.getMaxAnisotropy() || 1); }

/** Linear magnification, trilinear minification and anisotropic filtering (no-op on flagged or already smooth ones). */
export function smoothTexture(t: THREE.Texture | null | undefined): void {
  if (!t || t.userData.crisp || t.userData.smooth || (t as THREE.DataTexture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) return;
  t.userData.smooth = true;
  if ((t as THREE.CompressedTexture).isCompressedTexture) return;
  let changed = false;
  if (t.magFilter !== THREE.LinearFilter) { t.magFilter = THREE.LinearFilter; changed = true; }
  if (t.minFilter === THREE.NearestFilter || t.minFilter === THREE.NearestMipmapNearestFilter || t.minFilter === THREE.NearestMipmapLinearFilter || t.minFilter === THREE.LinearMipmapNearestFilter) {
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; changed = true;
  }
  if (t.anisotropy < maxAniso) { t.anisotropy = maxAniso; changed = true; }
  const img = t.image as { width?: number; complete?: boolean } | undefined;
  if (changed && img && (img.width ?? 0) > 0 && img.complete !== false) t.needsUpdate = true;
}

/** smoothTexture on every map of every mesh material under root (each material once). */
export function smoothMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Sprite).isSprite) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as (THREE.Material & Record<string, unknown>)[]) {
      if (!mat || mat.userData.smoothed || mat.userData.crisp) continue;
      mat.userData.smoothed = true;
      for (const k of MAPS) smoothTexture(mat[k] as THREE.Texture | undefined);
    }
  });
}

// ------------------------------------------------------------------ photo detail

export type DetailKind = 'wood' | 'plaster';
/** per kind: how strongly the scan's brightness shows in the albedo, the relief, and the roughness swing */
const KIND: Record<DetailKind, { albedo: number; normal: number; rough: number }> = {
  wood: { albedo: 0.22, normal: 0.6, rough: 0.25 },
  plaster: { albedo: 0.14, normal: 0.5, rough: 0.15 },
};
const loader = new THREE.TextureLoader();
const bases = new Map<DetailKind, { tex: THREE.Texture; loaded: boolean; copies: THREE.Texture[] }>();
function detailBase(kind: DetailKind) {
  let b = bases.get(kind);
  if (b) return b;
  const rec: { tex: THREE.Texture; loaded: boolean; copies: THREE.Texture[] } = { tex: null as unknown as THREE.Texture, loaded: false, copies: [] };
  rec.tex = loader.load(`${import.meta.env.BASE_URL}textures/detail/${kind}_d.webp`, () => {
    rec.loaded = true;
    for (const c of rec.copies) c.needsUpdate = true;
  }, undefined, () => console.warn('detail texture missing', kind));
  const t = rec.tex;
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = maxAniso;
  t.userData.smooth = true;
  bases.set(kind, (b = rec));
  return b;
}

// the packed normal: x and y from red and green, z rebuilt (blue holds the brightness detail)
const NORMAL_MAPS = THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = vec3( texture2D( normalMap, vNormalMapUv ).xy * 2.0 - 1.0, 0.0 );
	mapN.z = sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) );`);
if (NORMAL_MAPS === THREE.ShaderChunk.normal_fragment_maps) console.warn('[surface] three changed normal_fragment_maps; detail relief is off');

export interface DetailOpts {
  /** tiles across the material's uv 0..1 (one number for both axes, or [u, v]) */
  repeat: number | [number, number];
  /** turn the detail (radians), e.g. to run the wood grain along the boards */
  rotation?: number;
  /** multipliers on the kind's defaults */
  albedo?: number; normal?: number; rough?: number;
}

/**
 * Lay a tiling photo detail over a lit material (MeshStandardMaterial or MeshLambertMaterial; it must not have a
 * normal map of its own). The detail uses the material's own uvs, so `repeat` is in tiles per uv unit.
 */
export function addDetail<M extends THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>(mat: M, kind: DetailKind, o: DetailOpts): M {
  if (mat.userData.detail) return mat;
  mat.userData.detail = kind;
  const b = detailBase(kind), k = KIND[kind];
  const t = b.tex.clone();
  const [ru, rv] = typeof o.repeat === 'number' ? [o.repeat, o.repeat] : o.repeat;
  t.repeat.set(ru, rv);
  t.rotation = o.rotation ?? 0;
  t.userData.smooth = true;
  // (a clone is marked for upload; before the scan has loaded that would only warn, so it waits for the load)
  if (b.loaded) t.needsUpdate = true; else { t.version = 0; b.copies.push(t); }
  mat.normalMap = t;
  const ns = k.normal * (o.normal ?? 1);
  mat.normalScale.set(ns, ns);
  const A = (k.albedo * (o.albedo ?? 1)).toFixed(3), R = (k.rough * (o.rough ?? 1)).toFixed(3);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
	float hhDetail = texture2D( normalMap, vNormalMapUv ).b;
	diffuseColor.rgb *= 1.0 + ( hhDetail - 0.5 ) * ${A} * 2.0;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
	roughnessFactor = clamp( roughnessFactor + ( 0.5 - hhDetail ) * ${R}, 0.05, 1.0 );`)
      .replace('#include <normal_fragment_maps>', NORMAL_MAPS);
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (key ? key() : '') + `|detail:${kind}:${A}:${R}`;
  mat.needsUpdate = true;
  return mat;
}
