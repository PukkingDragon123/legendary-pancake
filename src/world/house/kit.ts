// The see-through-walls shader patch used in the top-down build view: walls between the camera and the room
// dissolve on a pixel dither grid, and everything above the edited floor goes.
import * as THREE from 'three';

/** Shared uniforms: when on, walls between the camera and the room dissolve on a dither grid. */
export const CUT = {
  uCutOn: { value: 0 },
  uCutCam: { value: new THREE.Vector3() },
  uCutCenter: { value: new THREE.Vector3() },
  /** world y above which walls may dissolve */
  uCutY: { value: 0 },
  /** world y above which everything dissolves (the floors above) */
  uCutTop: { value: 999 },
};

/** Patch a material so it honours CUT. Safe to call once per material. */
export function patchCut(m: THREE.Material) {
  if ((m as { userData: Record<string, unknown> }).userData.cut) return;
  m.userData.cut = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, CUT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvCutW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;\nuniform float uCutOn; uniform vec3 uCutCam; uniform vec3 uCutCenter; uniform float uCutY; uniform float uCutTop;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uCutOn > 0.0) {
  vec2 dp = vCutW.xz - uCutCenter.xz;
  vec2 dc = uCutCam.xz - uCutCenter.xz;
  float side = dot(normalize(dp + 1e-4), normalize(dc + 1e-4));
  vec2 q = floor(gl_FragCoord.xy / 2.0);
  float th = fract(dot(q, vec2(0.5, 0.25)) + 0.125 * mod(q.x, 2.0));
  float k = smoothstep(-0.05, 0.35, side) * smoothstep(uCutY, uCutY + 0.25, vCutW.y) * uCutOn;
  if (vCutW.y > uCutTop) k = 1.0;
  if (k > th + 0.02) discard;
}`);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|cut';
}
