// Soft downy plumage: shell fur over the painted owl. Each furry part (body, head, feathered legs) gets one instanced
// mesh of its own geometry drawn SHELLS times, each copy pushed a little further out along the normal and combed down
// the feather flow (and swayed by breath and a breeze). In every shell a strand field (a tiny random texture, crisp
// texels) keeps only the strands that reach that far, thinning toward the tips; the strands take the atlas colour,
// darker at their roots and paler at the tips, and the fur-length mask the owl builder bakes into the roughness map's
// red channel (art/blender/owls/plume.py fur_len) decides where fluff grows: full on the body, finer on the facial
// disc, none on the bill, the talons, the scaled toes or round the eyes (the ink dots stay clear).
// One extra draw call per part; shells cast no shadows.
import * as THREE from 'three';

/** The most shells a part can draw (its instanced mesh is allocated for this many). */
export const SHELLS = 8;

/** The shell count before the scene says otherwise (Scene.setTier -> setFurQuality keeps it in step with look4's cost
 * tier, auto-downgrades included): look4's deviceTier rule, phones and small machines medium (5), the rest high (8). */
function deviceShells(): number {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const small = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 820;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '') || (touch && small);
    return mobile || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 ? 5 : 8;
  } catch { return 5; }
}
let shellCount = deviceShells();
const live = new Set<THREE.InstancedMesh>();
const shellUniform = { value: shellCount };
/** Set the fur's shell count (1..SHELLS) for every owl now and later, e.g. from the scene's quality tier
 * ('high' 8, 'medium' 5, 'low' 3). Fewer shells keep the same fluff length, only coarser. */
export function setFurShells(n: number) {
  shellCount = Math.max(1, Math.min(SHELLS, Math.round(n)));
  shellUniform.value = shellCount;
  for (const im of live) im.count = shellCount;
}
export const furShellCount = () => shellCount;
/** Forget the shells under an owl that is being thrown away (the live set only tracks owls on screen). */
export function dropFur(root: THREE.Object3D) {
  root.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) live.delete(o as THREE.InstancedMesh); });
}
export function setFurQuality(tier: 'low' | 'medium' | 'high') { setFurShells(tier === 'high' ? 8 : tier === 'medium' ? 5 : 3); }

export interface FurUniforms {
  uLen: { value: number };
  uScale: { value: number };
  uWind: { value: THREE.Vector3 };
  uComb: { value: THREE.Vector3 };
  uStrands: { value: THREE.Texture };
  uMask: { value: THREE.Texture | null };
}

let strandTex: THREE.DataTexture | null = null;
/** The strand field: each texel one strand's height (0..1), a little clumped so tips gather like real down. */
function strands(): THREE.DataTexture {
  if (strandTex) return strandTex;
  const n = 64, d = new Uint8Array(n * n * 4);
  let s = 0x2f6b1d;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  const raw = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) raw[i] = rnd();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // clumps: a strand leans toward its neighbourhood's average (soft tufts), most strands long, a few short
    let acc = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) acc += raw[((y + dy + n) % n) * n + ((x + dx + n) % n)];
    const v = Math.min(1, Math.max(0, 0.55 * raw[y * n + x] + 0.45 * (acc / 9) * 1.15));
    const i = (y * n + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = Math.round(v * 255); d[i + 3] = 255;
  }
  strandTex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.magFilter = THREE.NearestFilter;
  strandTex.minFilter = THREE.NearestFilter;
  strandTex.generateMipmaps = false;
  strandTex.needsUpdate = true;
  return strandTex;
}

/** The shell material for a painted part (its atlas and its fur mask), sharing `u` (the owl's fur uniforms). */
export function furMaterial(src: THREE.MeshStandardMaterial, u: FurUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.95, metalness: 0, side: THREE.FrontSide, emissive: 0xffffff, emissiveMap: src.map, emissiveIntensity: 0.07 });
  m.name = 'fur';
  m.defines = { ...src.defines }; // [light7] the coat's cel knobs (rim) carry over to its fluff
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, { uShells: shellUniform });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uLen; uniform float uShells; uniform vec3 uWind; uniform vec3 uComb; varying float vShell;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float shf = (float(gl_InstanceID) + 1.0) / uShells;
        vec3 fn = normalize(objectNormal);
        vec3 comb = uComb - fn * dot(uComb, fn);
        transformed += fn * (shf * uLen) + comb * (shf * shf * uLen) + uWind * (shf * shf);
        vShell = shf;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uScale; uniform sampler2D uStrands; uniform sampler2D uMask; varying float vShell;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float furLen = texture2D(uMask, vMapUv).r;
        float strand = texture2D(uStrands, vMapUv * vec2(uScale * 1.5, uScale * 0.62)).r;
        if (vShell > furLen * 1.02 || strand < 0.18 + vShell * 0.8) discard;
        // roots in the shade of the down around them, tips catching the light
        diffuseColor.rgb *= mix(0.62, 1.12, vShell) * (0.92 + 0.16 * strand);`);
  };
  m.customProgramCacheKey = () => 'owl-fur';
  return m;
}

/** Shells for one painted mesh (null when the part has no fur mask to read). */
export function furShells(mesh: THREE.Mesh, u: FurUniforms): THREE.InstancedMesh | null {
  const src = mesh.material as THREE.MeshStandardMaterial;
  if (!src?.map || !src.roughnessMap || !mesh.geometry.attributes.normal) return null;
  if (!u.uMask.value) u.uMask.value = src.roughnessMap;
  const im = new THREE.InstancedMesh(mesh.geometry, furMaterial(src, u), SHELLS);
  for (let i = 0; i < SHELLS; i++) im.setMatrixAt(i, new THREE.Matrix4());
  im.instanceMatrix.needsUpdate = true;
  im.name = mesh.name + ':fur';
  im.castShadow = false;
  im.receiveShadow = true;
  im.frustumCulled = false;
  im.count = shellCount;
  live.add(im);
  im.position.copy(mesh.position); im.quaternion.copy(mesh.quaternion); im.scale.copy(mesh.scale);
  return im;
}

export function furUniforms(len: number, scale: number): FurUniforms {
  return {
    uLen: { value: len }, uScale: { value: scale }, uWind: { value: new THREE.Vector3() }, uComb: { value: new THREE.Vector3(0, -0.55, -0.12) },
    uStrands: { value: strands() }, uMask: { value: null },
  };
}
