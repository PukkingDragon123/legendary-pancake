import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { INK_HEX, INK_GLSL, Ink, defaultInk, inkHull, inkMaterial, installInk } from './ink.ts';

describe('ink outlines', () => {
  it('patches opaque materials to write their ink class, once', () => {
    installInk();
    installInk();
    const chunk = THREE.ShaderChunk.opaque_fragment;
    expect(chunk.match(/gl_FragColor\.a = hhInk;/g)?.length).toBe(1);
    // the plain class is "full"; alpha-cut double-sided cards are "silhouette only"; unlit is "none"
    expect(chunk).toContain('#define HH_INK 0.25');
    expect(chunk).toContain('#define HH_INK 0.5');
    expect(THREE.ShaderLib.basic.fragmentShader.startsWith('#define HH_UNLIT\n')).toBe(true);
    expect(THREE.ShaderLib.basic.fragmentShader.indexOf('#define HH_UNLIT')).toBe(THREE.ShaderLib.basic.fragmentShader.lastIndexOf('#define HH_UNLIT'));
    expect(THREE.ShaderLib.standard.fragmentShader).not.toContain('HH_UNLIT');
  });

  it('gives lit materials a per-object id, once', () => {
    installInk();
    expect(THREE.ShaderChunk.project_vertex.match(/vHhInkId =/g)?.length).toBe(1);
    for (const id of ['standard', 'physical', 'lambert']) {
      const lib = THREE.ShaderLib[id];
      expect(lib.vertexShader.startsWith('#define HH_INKID\nvarying float vHhInkId;')).toBe(true);
      expect(lib.fragmentShader.lastIndexOf('#define HH_INKID')).toBe(0);
    }
    expect(THREE.ShaderLib.basic.vertexShader).not.toContain('HH_INKID');
  });

  it('sets a material class as a define and recompiles only on change', () => {
    const m = new THREE.MeshStandardMaterial();
    const v0 = m.version;
    inkMaterial(m, 'none');
    expect((m.defines as Record<string, string>).HH_INK).toBe('1.0');
    const v1 = m.version;
    expect(v1).toBeGreaterThan(v0);
    inkMaterial(m, 'none');
    expect(m.version).toBe(v1);
    inkMaterial(m, 'sil');
    expect((m.defines as Record<string, string>).HH_INK).toBe('0.5');
  });

  it('draws outlines about 2 device px on 1x screens and 2.4 on 2x ones, creases 1.15 / 1.45, in target px', () => {
    const k = defaultInk();
    expect(Ink.widthPx(k, 1, 1)).toBeCloseTo(2);
    expect(Ink.widthPx(k, 1, 2)).toBeCloseTo(2.4);
    expect(Ink.widthPx(k, 1, 3)).toBeCloseTo(2.4);
    expect(Ink.creasePx(k, 1, 1)).toBeCloseTo(1.15);
    expect(Ink.creasePx(k, 1, 2)).toBeCloseTo(1.45);
    // the low tier's smaller target: fewer target px for the same line on screen
    expect(Ink.widthPx(k, 1 / 0.68, 2)).toBeCloseTo(2.4 * 0.68);
    expect(Ink.widthPx({ ...k, width: 2 }, 1, 1)).toBeCloseTo(4);
  });

  it('bakes the ink colour into the composite snippet', () => {
    const r = ((INK_HEX >> 16) & 255) / 255;
    expect(INK_GLSL).toContain(`vec3(${r},`);
    expect(INK_GLSL).toContain('float inkCover(vec2 uv)');
  });

  it('builds a translucent back-face hull that shares the part geometry', () => {
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const part = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    part.name = 'body';
    const u = { uLen: { value: 0.1 }, uComb: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector3() }, uMask: { value: null } };
    const h = inkHull(part, u);
    const mat = h.material as THREE.ShaderMaterial;
    expect(h.geometry).toBe(geo);
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.uniforms.uLen).toBe(u.uLen);
    expect(h.castShadow).toBe(false);
  });
});
