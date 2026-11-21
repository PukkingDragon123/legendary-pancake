// [world3] The forest floor up close: hand-pixelled decals lying flat on the ground and the pond.
// Pebbles and gravel, flat stepping stones on the path, twigs, pine cones and needles under the
// pines, acorns under the oaks, fallen leaves (more of them in autumn), cushion moss, clover,
// blossom petals in spring, a lost owl feather, and lily pads with the odd water-lily on the pond.
// One 256x96 atlas painted at load in the calm palette, drawn as instanced flat quads (one draw
// call per area), lit by the same sun, sky and dappled canopy light as the grass, and buried by snow.
import * as THREE from 'three';
import { mixc, P, shade } from '../gfx/palette.ts';
import { rng } from '../gfx/noise.ts';
import type { SeasonInfo } from './astro.ts';
import { GRASS } from './grass.ts';
import { WX } from './weather.ts';

const CS = 32, COLS = 8, ROWS = 3, AW = CS * COLS, AH = CS * ROWS;
/** Decal cells. */
export const LT = {
  pebbles: 0, gravel: 1, stone: 2, stone2: 3, twig: 4, twigs: 5, cone: 6, needles: 7,
  acorns: 8, leaves: 9, leaves2: 10, leafdry: 11, moss: 12, clover: 13, petals: 14, lily: 15,
  lilies: 16, lotus: 17, feather: 18,
} as const;

/** One decal. group: 0 always there, 1 fallen leaves (thicker in autumn), 2 blossom petals (spring). */
export interface LitterItem { x: number; y: number; z: number; rot: number; size: number; cell: number; tint: number; group: number }

// ---------------------------------------------------------------- painting

class Pix {
  readonly data = new Uint8Array(AW * AH * 4);
  private ox = 0; private oy = 0;
  cell(i: number) { this.ox = (i % COLS) * CS; this.oy = Math.floor(i / COLS) * CS; }
  /** y grows downwards in cell space (image rows); the texture is flipped when uploaded */
  set(x: number, y: number, c: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= CS || y >= CS) return;
    const k = ((this.oy + y) * AW + this.ox + x) * 4;
    this.data[k] = (c >> 16) & 255; this.data[k + 1] = (c >> 8) & 255; this.data[k + 2] = c & 255; this.data[k + 3] = 255;
  }
  has(x: number, y: number) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= CS || y >= CS) return false; return this.data[((this.oy + y) * AW + this.ox + x) * 4 + 3] > 0; }
  /** A filled blob with a hand-shaded ramp. The image top lies away from the camera (north) and the sun
   *  comes from the camera side, so blobs are lit from the bottom-left with a dark rim top-right. */
  blob(cx: number, cy: number, rx: number, ry: number, ramp: number[], o: { rot?: number; rough?: number; seed?: number; outline?: boolean; tex?: (x: number, y: number, l: number) => number } = {}) {
    const r = rng(o.seed ?? 7), rough = o.rough ?? 0.15, rot = o.rot ?? 0, cr = Math.cos(rot), sr = Math.sin(rot);
    const bumps = [r() * 6.28, r() * 6.28, r() * 6.28];
    const inside = (x: number, y: number) => {
      const dx = x - cx, dy = y - cy, u = (dx * cr + dy * sr) / rx, v = (-dx * sr + dy * cr) / ry;
      const a = Math.atan2(v, u);
      const k = 1 + rough * (Math.sin(a * 3 + bumps[0]) * 0.5 + Math.sin(a * 5 + bumps[1]) * 0.3 + Math.sin(a * 2 + bumps[2]) * 0.4);
      return u * u + v * v <= k * k;
    };
    const pts: [number, number][] = [];
    const R = Math.max(rx, ry) * (1 + rough) + 1;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) if (inside(x + 0.5, y + 0.5)) pts.push([x, y]);
    const set = new Set(pts.map(([x, y]) => y * 100 + x));
    for (const [x, y] of pts) {
      const edgeDR = !set.has(y * 100 + x + 1) || !set.has((y - 1) * 100 + x);
      const edgeUL = !set.has(y * 100 + x - 1) || !set.has((y + 1) * 100 + x);
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      // light from the bottom-left: a stepped ramp index
      let l = Math.round((ramp.length - 1) * (0.62 - dx * 0.28 + dy * 0.34));
      if (edgeUL && !edgeDR) l += 1;
      if (edgeDR) l = o.outline === false ? Math.max(0, l - 2) : 0;
      l = Math.max(0, Math.min(ramp.length - 1, l));
      this.set(x, y, o.tex ? o.tex(x, y, l) : ramp[l]);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, w = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      this.set(x, y, c);
      if (w > 1) this.set(x, y + 1, c);
    }
  }
  /** A stick: dark underside, lit top edge, a knot or two. */
  stick(x0: number, y0: number, x1: number, y1: number, ramp: number[]) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      this.set(x, y - 1, ramp[0]); this.set(x, y, ramp[i % 5 === 2 ? 1 : 2]); this.set(x, y + 1, i % 7 === 3 ? ramp[2] : ramp[3]);
    }
  }
  /** A leaf from its stalk at (x, y) pointing along `a`. */
  leaf(x: number, y: number, a: number, len: number, wid: number, ramp: number[], lobed = false) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const R = len + wid;
    const pts: [number, number, number, number][] = [];
    for (let j = Math.floor(y - R); j <= Math.ceil(y + R); j++) for (let i = Math.floor(x - R); i <= Math.ceil(x + R); i++) {
      const dx = i + 0.5 - x, dy = j + 0.5 - y, u = (dx * ca + dy * sa) / len, v = (-dx * sa + dy * ca) / wid;
      if (u < 0 || u > 1) continue;
      let w = Math.pow(Math.sin(Math.PI * u), 0.6) * 0.5;
      if (lobed) w *= 0.74 + 0.26 * Math.cos(u * Math.PI * 2 * 3.2 + 0.4);
      if (Math.abs(v) <= w) pts.push([i, j, u, v]);
    }
    const set = new Set(pts.map(([i, j]) => j * 100 + i));
    for (const [i, j, u, v] of pts) {
      const edge = !set.has(j * 100 + i + 1) || !set.has(j * 100 + i - 1) || !set.has((j + 1) * 100 + i) || !set.has((j - 1) * 100 + i);
      let l = v * (sa > 0 ? -1 : 1) > 0 ? 3 : 2;
      if (Math.abs(v) < 0.07 && u > 0.08 && u < 0.85) l = 1;
      if (u > 0.4 && u < 0.7 && Math.abs(v) > 0.14 && Math.abs(v) < 0.24 && l === 3) l = 4;
      this.set(i, j, edge ? ramp[0] : ramp[Math.min(ramp.length - 1, l)]);
    }
    this.line(x, y, x - ca * 2, y - sa * 2, ramp[1]);
  }
}

/** Hue-shifted ramps (dark -> light) built from the palette. */
const rampOf = (c: number, n = 5) => Array.from({ length: n }, (_, i) => {
  const k = i / (n - 1);
  return k < 0.5 ? mixc(shade(c, 0.45 + k), P.slate, 0.3 * (1 - k * 2)) : mixc(shade(c, 0.95 + (k - 0.5) * 0.5), P.lamp, (k - 0.5) * 0.3);
});

export function paintLitter(): Uint8Array {
  const p = new Pix(), r = rng(5150);
  const stone = rampOf(P.stone, 6), pebble = rampOf(P.pebble, 6), dark = rampOf(P.stoneDark, 5);
  const bark = rampOf(P.bark, 5), wood = rampOf(P.woodDark, 5), moss = rampOf(P.moss, 6), fern = rampOf(P.fern, 5);
  const ochre = rampOf(P.ochre, 5), rust = rampOf(P.clay, 5), olive = rampOf(0x8a8a4a, 5), honey = rampOf(P.honey, 5), umber = rampOf(P.umber, 5);
  const lily = rampOf(0x5f7d4c, 6), rose = rampOf(P.rose, 5), blush = rampOf(P.blush, 5), paper = rampOf(P.paper, 4), cream = rampOf(P.cream, 5), buff = rampOf(P.buff, 5);

  // pebbles: a handful of rounded stones with a tuft of moss
  p.cell(LT.pebbles);
  for (const [x, y, rx, ry, rp] of [[10, 12, 5, 4, stone], [20, 18, 4, 3.2, pebble], [13, 22, 3, 2.4, dark], [23, 9, 2.6, 2.2, pebble], [6, 20, 2, 1.6, stone]] as const) p.blob(x, y, rx, ry, rp as number[], { seed: x * 7 + y, rough: 0.12 });
  for (let i = 0; i < 6; i++) p.set(15 + (i % 3), 13 + Math.floor(i / 3), moss[2 + (i % 3)]);
  // gravel: grit and little stones
  p.cell(LT.gravel);
  for (let i = 0; i < 26; i++) { const x = 3 + r() * 26, y = 3 + r() * 26, s = r(); const rp = s < 0.4 ? pebble : s < 0.75 ? stone : dark; if (s < 0.25) p.blob(x, y, 1.6, 1.3, rp, { seed: i }); else { p.set(x, y, rp[3]); p.set(x + 1, y, rp[1]); p.set(x, y + 1, rp[0]); } }
  // stepping stones: big flat slabs worn smooth, a crack, moss creeping in at the rim
  for (const [cell, seed] of [[LT.stone, 11], [LT.stone2, 12]] as const) {
    p.cell(cell);
    const rr = rng(seed);
    p.blob(16, 16, 13, 10.5, stone, { seed, rough: 0.16, rot: rr() * 0.6, tex: (x, y, l) => (l > 0 && (x * 7 + y * 13) % 11 === 0 ? stone[Math.max(1, l - 1)] : (x + y * 3) % 17 === 0 && l > 1 ? stone[Math.min(5, l + 1)] : stone[l]) });
    let cx = 9 + rr() * 6, cy = 10 + rr() * 4;
    for (let i = 0; i < 12; i++) { p.set(cx, cy, stone[0]); p.set(cx + 1, cy - 1, stone[4]); cx += 1; cy += rr() < 0.5 ? 1 : 0; }
    for (let i = 0; i < 18; i++) { const a = rr() * 6.28; const x = 16 + Math.cos(a) * 12.5, y = 16 + Math.sin(a) * 10; if (p.has(x, y)) { p.set(x, y, moss[2 + Math.floor(rr() * 3)]); p.set(x + 1, y, moss[3]); } }
  }
  // twigs
  p.cell(LT.twig); p.stick(4, 20, 27, 11, bark); p.stick(16, 15, 22, 22, bark); p.stick(9, 18, 7, 25, bark);
  p.cell(LT.twigs); p.stick(3, 9, 28, 21, wood); p.stick(6, 24, 26, 7, bark); p.leaf(18, 24, -0.4, 9, 5, ochre, true);
  // a pine cone lying on its side with loose needles
  p.cell(LT.needles);
  for (let i = 0; i < 22; i++) { const x = 3 + r() * 25, y = 3 + r() * 25, a = r() * 6.28, L = 4 + r() * 4; p.line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, i % 3 ? umber[2] : ochre[1]); }
  p.cell(LT.cone);
  for (let i = 0; i < 14; i++) { const x = 3 + r() * 25, y = 3 + r() * 25, a = r() * 6.28; p.line(x, y, x + Math.cos(a) * 5, y + Math.sin(a) * 5, umber[1 + (i % 2)]); }
  p.blob(15, 16, 8, 4.6, umber, { seed: 3, rough: 0.05, rot: -0.4, tex: (x, y, l) => ((x + y) % 3 === 0 ? umber[Math.max(0, l - 2)] : (x - y + 30) % 3 === 0 ? honey[Math.min(4, l)] : umber[l]) });
  p.line(22, 12, 25, 10, bark[1]);
  // acorns with their cups, and an oak leaf
  p.cell(LT.acorns);
  p.leaf(6, 24, -0.6, 17, 10, olive, true);
  for (const [x, y] of [[20, 14], [12, 19], [24, 22]] as const) { p.blob(x, y, 2.6, 3.4, honey, { seed: x, rough: 0 }); p.blob(x, y - 3, 3, 1.6, umber, { seed: y, rough: 0.05 }); p.set(x, y - 5, bark[1]); }
  // fallen leaves: oak, maple-ish and birch in autumn colours
  p.cell(LT.leaves);
  p.leaf(5, 25, -0.7, 15, 9, ochre, true); p.leaf(27, 22, 3.6, 13, 8, rust, true); p.leaf(14, 6, 1.4, 14, 8, olive, true); p.leaf(26, 6, 2.4, 9, 5, honey);
  p.cell(LT.leaves2);
  for (let i = 0; i < 7; i++) p.leaf(4 + r() * 22, 6 + r() * 22, r() * 6.28, 7 + r() * 3, 4.5, [honey, ochre, olive][i % 3]);
  p.cell(LT.leafdry);
  p.leaf(4, 26, -0.75, 26, 15, umber, true); p.line(8, 22, 12, 18, umber[1]); p.line(13, 18, 18, 17, umber[1]);
  // cushion moss with tiny fruiting stalks
  p.cell(LT.moss);
  p.blob(16, 17, 12, 9, moss, { seed: 21, rough: 0.28, tex: (x, y, l) => ((x * 5 + y * 3) % 7 === 0 ? moss[Math.min(5, l + 1)] : (x * 3 + y * 11) % 13 === 0 ? fern[1] : moss[l]) });
  p.blob(9, 11, 5, 4, fern, { seed: 22, rough: 0.3 });
  for (let i = 0; i < 7; i++) { const x = 8 + r() * 16, y = 10 + r() * 12; p.set(x, y, ochre[3]); p.set(x, y + 1, ochre[1]); }
  // clover: trefoils and one white flower head
  p.cell(LT.clover);
  for (let i = 0; i < 6; i++) {
    const x = 6 + r() * 20, y = 6 + r() * 20;
    for (const a of [0, 2.1, 4.2]) p.blob(x + Math.cos(a + i) * 2.2, y + Math.sin(a + i) * 2.2, 2, 1.8, fern, { seed: i * 3 + a, rough: 0, outline: false });
  }
  p.blob(20, 12, 2.6, 2.6, paper, { seed: 1, rough: 0.2 });
  // blossom petals
  p.cell(LT.petals);
  for (let i = 0; i < 12; i++) { const x = 3 + r() * 25, y = 3 + r() * 25; p.blob(x, y, 1.8, 1.2, i % 3 ? rose : blush, { seed: i, rot: r() * 3, rough: 0.1, outline: false }); }
  // lily pads: a notch to the centre, radial veins
  const pad = (cx: number, cy: number, R: number, notch: number) => {
    p.blob(cx, cy, R, R * 0.92, lily, {
      seed: Math.round(cx * 3 + cy), rough: 0.04,
      tex: (x, y, l) => {
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx), d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        let da = a - notch; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.22 && d > 1) return -1;
        if (d > 1.5 && Math.abs(Math.sin(a * 4)) < 0.1) return lily[Math.max(0, l - 1)];
        return lily[l];
      },
    });
  };
  const clearNeg = () => { for (let k = 0; k < p.data.length; k += 4) if (p.data[k] === 255 && p.data[k + 1] === 255 && p.data[k + 2] === 255 && p.data[k + 3] === 255) p.data[k + 3] = 0; };
  p.cell(LT.lily); pad(16, 16, 13, 0.6);
  p.cell(LT.lilies); pad(11, 12, 8, 2.4); pad(23, 22, 6.5, -0.8);
  p.cell(LT.lotus); pad(14, 18, 11, 1.2);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; p.blob(19 + Math.cos(a) * 3, 13 + Math.sin(a) * 3, 2.6, 1.6, i % 2 ? paper : blush, { seed: i, rot: a, rough: 0, outline: false }); }
  p.blob(19, 13, 1.6, 1.6, honey, { seed: 9, rough: 0 });
  // a lost owl feather: barred buff and umber
  p.cell(LT.feather);
  for (let i = 0; i < 22; i++) {
    const x = 6 + i, y = 25 - i * 0.8, w = Math.round(Math.sin((i / 22) * Math.PI) * 3.4);
    for (let k = -w; k <= w; k++) p.set(x + k * 0.3, y + k, i % 4 < 2 ? buff[k < 0 ? 3 : 2] : umber[k < 0 ? 3 : 2]);
    p.set(x, y, cream[1]);
  }
  p.line(4, 27, 7, 24, cream[1]);
  clearNeg();
  return p.data;
}

// ---------------------------------------------------------------- the decals

const VS = /* glsl */ `
attribute vec4 iPos; attribute vec4 iData;
uniform float uLeaves; uniform float uPetals;
varying vec2 vUv; varying vec3 vW; varying float vTint; varying float vHide; varying float vSeed;
#include <fog_pars_vertex>
void main() {
  float c = cos(iPos.w), s = sin(iPos.w);
  vec2 q = mat2(c, -s, s, c) * position.xy * iData.x;
  // image top points north (away from the default camera)
  vec3 w = vec3(iPos.x + q.x, iPos.y + 0.012 + fract(iData.y * 0.37) * 0.006, iPos.z - q.y);
  float cell = iData.y;
  vUv = (vec2(mod(cell, ${COLS.toFixed(1)}), ${(ROWS - 1).toFixed(1)} - floor(cell / ${COLS.toFixed(1)})) + uv) / vec2(${COLS.toFixed(1)}, ${ROWS.toFixed(1)});
  vW = w; vTint = iData.z;
  float h = fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vSeed = h;
  vHide = iData.w > 1.5 ? step(uPetals, h) : iData.w > 0.5 ? step(uLeaves, h) : 0.0;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = /* glsl */ `
uniform sampler2D uMap; uniform sampler2D uCloud;
uniform vec3 uKey; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uSunDir;
uniform float uDapple; uniform float uTime; uniform vec2 uWind; uniform vec3 uSeason;
uniform float uSnow; uniform float uWet;
varying vec2 vUv; varying vec3 vW; varying float vTint; varying float vHide; varying float vSeed;
#include <fog_pars_fragment>
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  if (vHide > 0.5) discard;
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  // buried under snow, a few at a time as it thickens
  if (uSnow > 0.02 && vSeed < uSnow * 1.15) discard;
  vec2 sway = uWind * (sin(uTime * 0.9 + vW.x * 0.3) * 0.05 + sin(uTime * 1.7 + vW.z * 0.4) * 0.025);
  float n = texture2D(uCloud, vW.xz * 0.11 + sway).r * 0.65 + texture2D(uCloud, vW.xz * 0.31 - sway * 2.0 + 0.4).r * 0.35;
  float sd = smoothstep(0.36, 0.46, n);
  sd = floor(sd * 3.0 + bayer4(gl_FragCoord.xy) * 0.999) / 3.0;
  float sun = mix(1.0, mix(0.42, 1.0, sd), uDapple);
  vec3 amb = mix(uGround, uSky, 0.75) * 0.72;
  vec3 lit = amb + uKey * (0.6 * sun + 0.06) * max(uSunDir.y, 0.25);
  vec3 col = t.rgb * vTint * uSeason * lit * (1.0 - uWet * 0.28);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

let atlasTex: THREE.DataTexture | null = null;
function atlas() {
  if (atlasTex) return atlasTex;
  // rows were painted top-down: flip so v grows upwards
  const src = paintLitter(), flipped = new Uint8Array(src.length), row = AW * 4;
  for (let y = 0; y < AH; y++) flipped.set(src.subarray(y * row, (y + 1) * row), (AH - 1 - y) * row);
  const t = new THREE.DataTexture(flipped, AW, AH, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return (atlasTex = t);
}

const FREE = new Set<number>([LT.twig, LT.twigs, LT.needles, LT.leaves, LT.leaves2, LT.leafdry, LT.petals, LT.feather, LT.gravel]);

export class Litter {
  readonly group = new THREE.Group();
  readonly mat: THREE.ShaderMaterial;
  readonly u = { uLeaves: { value: 0.5 }, uPetals: { value: 0 }, uSeason: { value: new THREE.Vector3(1, 1, 1) } };
  constructor(items: LitterItem[], cell = 10) {
    this.group.name = 'litter';
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, fog: true, side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null } }]),
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    Object.assign(this.mat.uniforms, {
      uMap: { value: atlas() }, uCloud: GRASS.uCloud, uKey: GRASS.uKey, uSky: GRASS.uSky, uGround: GRASS.uGround, uSunDir: GRASS.uSunDir,
      uDapple: GRASS.uDapple, uTime: GRASS.uTime, uWind: GRASS.uWind, uSnow: WX.uSnow, uWet: WX.uWet, ...this.u,
    });
    const P4 = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], U = [0, 0, 1, 0, 1, 1, 0, 1], I = [0, 2, 1, 0, 3, 2];
    const bins = new Map<string, LitterItem[]>();
    for (const it of items) {
      const key = `${Math.floor(it.x / cell)},${Math.floor(it.z / cell)}`;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key)!.push(it);
    }
    for (const list of bins.values()) {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P4, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      const n = list.length, pos = new Float32Array(n * 4), dat = new Float32Array(n * 4);
      const box = new THREE.Box3(), v = new THREE.Vector3();
      list.forEach((it, i) => {
        // things with painted light keep it on the sun side: only leaves, twigs and petals spin freely
        const rot = FREE.has(it.cell) ? it.rot : ((it.rot / 6.283) % 1) - 0.5;
        pos.set([it.x, it.y, it.z, rot], i * 4);
        dat.set([it.size, it.cell, it.tint, it.group], i * 4);
        box.expandByPoint(v.set(it.x, it.y, it.z));
      });
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 4));
      g.setAttribute('iData', new THREE.InstancedBufferAttribute(dat, 4));
      g.instanceCount = n;
      box.expandByScalar(1);
      g.boundingBox = box;
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(g, this.mat);
      m.renderOrder = 1;
      m.userData.noSnowMap = true;
      this.group.add(m);
    }
  }
  /** Leaves pile up in autumn and linger into winter, petals fall in spring. */
  setSeason(info: SeasonInfo) {
    const s = info.season;
    this.u.uLeaves.value = s === 'autumn' ? 0.75 + info.t * 0.25 : s === 'winter' ? 0.6 : s === 'summer' ? 0.32 : 0.22;
    this.u.uPetals.value = s === 'spring' ? 1 : 0;
    const tint: Record<string, [number, number, number]> = { spring: [0.98, 1.03, 0.95], summer: [1, 1, 1], autumn: [1.06, 0.98, 0.88], winter: [0.92, 0.93, 0.95] };
    this.u.uSeason.value.set(...tint[s]);
  }
  dispose() { for (const m of this.group.children) (m as THREE.Mesh).geometry.dispose(); this.mat.dispose(); }
}
