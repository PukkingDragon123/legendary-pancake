// The interview's answer objects that are modelled and painted in code for Hoot Hollow: properly turned cups and
// cans, a cassette tape (nine hand-labelled tapes with little cover pictures) and the portable cassette recorder
// they slide into, a plump pillow, a pillar candle, a desk microphone, brass sun and moon ornaments, a generic
// smartphone, a little wooden phone bed and a sheep stile. Every surface is a hand-painted pixel texture painted
// texel by texel (tex.ts): a mottled wash, then hundreds of short brush dabs with hue and value jitter, then worn
// edges and painted labels. No light is baked in; the overlay's lights and environment do the shading.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { F } from './fonts.ts';
import { alagardSafe, STACK } from '../ui/font.ts';
import { crispText, fbm, hash, mix3, mul3, pixelTex, rgb, Tex, vnoise, type RGB } from './tex.ts';

const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ painting

/** a deterministic random stream */
export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** shift a colour's value (v, +-) and hue (h: + warmer, - cooler) */
export const tint = (c: RGB, v: number, h = 0): RGB => [cl(c[0] * (1 + v) + h * 0.05), cl(c[1] * (1 + v) + h * 0.012), cl(c[2] * (1 + v) - h * 0.05)];

export interface StrokeOpts { n?: number; len?: number; ang?: number; angJ?: number; val?: number; hue?: number; a?: number; seed?: number; wrap?: boolean; w?: number }
/**
 * Brushwork: short strokes laid along `ang` (radians), each a jittered tint of the colour `col` says is under it.
 * This is what makes a texture read as painted: visible strokes, warm/cool hue variation, uneven value.
 */
export function strokes(t: Tex, x0: number, y0: number, w: number, h: number, col: (x: number, y: number) => RGB | null, o: StrokeOpts = {}) {
  const r = rng(o.seed ?? 7), n = o.n ?? Math.round((w * h) / 5), len = o.len ?? 4, val = o.val ?? 0.12, hue = o.hue ?? 0.6, A = o.a ?? 0.55;
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, c = col(x | 0, y | 0);
    if (!c) continue;
    const a = (o.ang ?? 0) + (r() - 0.5) * (o.angJ ?? 0.5), L = len * (0.5 + r()), cc = tint(c, (r() - 0.5) * val * 2, (r() - 0.5) * hue * 2), al = A * (0.6 + r() * 0.4);
    for (let s = 0; s <= L; s++) {
      let px = Math.round(x + Math.cos(a) * s), py = Math.round(y + Math.sin(a) * s);
      if (o.wrap) px = ((px % t.w) + t.w) % t.w;
      if (px < x0 && !o.wrap || px >= x0 + w && !o.wrap || py < y0 || py >= y0 + h) break;
      if (!col(px, py)) break;
      t.set(px, py, cc, al);
      if ((o.w ?? 1) > 1) t.set(px, py + 1, cc, al * 0.7);
    }
  }
}
/** A painted region: a mottled wash of `col`, then brushwork on top. */
export function wash(t: Tex, x0: number, y0: number, w: number, h: number, col: (x: number, y: number) => RGB | null, o: StrokeOpts & { mottle?: number } = {}) {
  const s = o.seed ?? 3, m = o.mottle ?? 0.1;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const c = col(x, y);
    if (!c) continue;
    t.set(x, y, tint(c, (fbm(x * 0.07, y * 0.07, s) - 0.5) * m * 2 + (hash(x, y, s) - 0.5) * m * 0.5, (vnoise(x * 0.04, y * 0.04, s + 5) - 0.5) * 0.8));
  }
  strokes(t, x0, y0, w, h, col, o);
}
/** worn, chipped edge: lighter rubbed texels near a band, occasional chips of `under` */
export function wear(t: Tex, inBand: (x: number, y: number) => number, o: { seed?: number; k?: number; chip?: RGB | null } = {}) {
  const s = o.seed ?? 11;
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    const b = inBand(x, y);
    if (b <= 0) continue;
    const n = vnoise(x * 0.3, y * 0.3, s);
    if (o.chip && n * b > 0.62 && hash(x, y, s + 1) > 0.35) t.set(x, y, o.chip);
    else if (n * b > 0.35) t.shade(x, y, 1 + (o.k ?? 0.18) * b);
  }
}
/** Hand-lettered text into a Tex (a pixel font, alpha snapped, with a little ink variation). */
export function letter(t: Tex, text: string, x: number, y: number, font: string, c: RGB, o: { align?: CanvasTextAlign; a?: number; jit?: number; spacing?: number; outline?: RGB } = {}) {
  const cv = document.createElement('canvas');
  cv.width = t.w; cv.height = t.h;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  crispText(g, text, x, y, font, '#000000', { align: o.align ?? 'center', spacing: o.spacing });
  const d = g.getImageData(0, 0, t.w, t.h).data;
  const on = (px: number, py: number) => px >= 0 && py >= 0 && px < t.w && py < t.h && d[(py * t.w + px) * 4 + 3] > 128;
  if (o.outline) for (let py = 0; py < t.h; py++) for (let px = 0; px < t.w; px++) if (!on(px, py) && (on(px - 1, py) || on(px + 1, py) || on(px, py - 1) || on(px, py + 1) || on(px + 1, py + 1))) t.set(px, py, o.outline);
  for (let py = 0; py < t.h; py++) for (let px = 0; px < t.w; px++) if (on(px, py)) t.set(px, py, tint(c, (hash(px, py, 77) - 0.5) * (o.jit ?? 0.2)), o.a ?? 1);
}
/** a soft-edged painted disc (cx, cy, r in texels) */
function blob(t: Tex, cx: number, cy: number, r: number, c: RGB | ((x: number, y: number) => RGB), a = 1, ry = r) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const d = Math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / ry);
    if (d <= 1 - (hash(x, y, 5) - 0.5) * 0.12) t.set(x, y, typeof c === 'function' ? c(x, y) : c, a);
  }
}
/** [dialog10] the answer objects are drawn at full device resolution now: their painted textures magnify smoothly
 * (a painted surface, not blocky texels) and stay sharp at grazing angles */
const smoothTex = <T extends THREE.Texture>(t: T): T => { t.magFilter = THREE.LinearFilter; t.anisotropy = 8; return t; };
const tex = (t: Tex, o: { repeat?: boolean } = {}) => smoothTex(t.texture({ repeat: o.repeat ?? false, q: 64 }));
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });

// ------------------------------------------------------------------ geometry helpers

/**
 * A turned part (a profile of [radius, y] revolved round Y) whose texture v runs along the profile by arc length,
 * so painted bands keep their proportions; u = 0.5 faces +z (the camera). `v[j]` is where point j sits on v.
 */
export function turn(pts: [number, number][], seg = 40): { g: THREE.BufferGeometry; v: number[] } {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const S = s[s.length - 1] || 1, v = s.map((x) => x / S);
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(1e-5, r), y)), seg);
  const uv = g.attributes.uv as THREE.BufferAttribute, n = pts.length;
  for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) uv.setXY(i * n + j, i / seg, v[j]);
  g.rotateY(Math.PI);
  return { g, v };
}
/** which profile segment a texture row falls on: p (0 bottom .. 1 end of profile) against the v of the points */
const seg = (v: number[], p: number) => { for (let j = 1; j < v.length; j++) if (p <= v[j]) return j - 1; return v.length - 2; };
/** paint a turned part's texture: f gets the column (around), the profile segment and the position along it */
function paintTurn(w: number, h: number, v: number[], f: (x: number, y: number, j: number, p: number) => RGB): Tex {
  const t = new Tex(w, h);
  for (let y = 0; y < h; y++) { const p = 1 - (y + 0.5) / h, j = seg(v, p); for (let x = 0; x < w; x++) t.set(x, y, f(x, y, j, p)); }
  return t;
}
/** a tube along points (a handle, a strap), its cross-section squashed to an oval */
function tube(pts: THREE.Vector3[], r: number, flat = 1, segs = 24, rad = 10) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, r, rad, false);
  if (flat !== 1) g.scale(1, 1, flat);
  return g;
}
function rrShape(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/**
 * Extrude a shape along +z (depth d, bevelled), centred on z; cap UVs remapped to the shape's bounds (u, v in 0..1,
 * the painted face), side UVs to world metres x `sideK` (a tiling side texture). Groups: 0 caps, 1 sides.
 */
function slab(shape: THREE.Shape, d: number, bevel: number, bounds: { x0: number; y0: number; w: number; h: number }, sideK = 20, curve = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  g.translate(0, 0, -d / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute, pos = g.attributes.position as THREE.BufferAttribute;
  const capEnd = g.groups[0] ? g.groups[0].count : 0;
  const idx = g.index;
  const isCap = new Uint8Array(pos.count);
  for (let i = 0; i < capEnd; i++) isCap[idx ? idx.getX(i) : i] = 1;
  for (let i = 0; i < pos.count; i++) {
    if (isCap[i]) uv.setXY(i, (pos.getX(i) - bounds.x0) / bounds.w, (pos.getY(i) - bounds.y0) / bounds.h);
    else uv.setXY(i, (pos.getX(i) + pos.getY(i)) * sideK, pos.getZ(i) * sideK);
  }
  return g;
}
const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };

export interface Prop { obj: THREE.Group; tick?: (t: number, dt: number) => void }

// ------------------------------------------------------------------ hot drinks: steam

/** a few wisps of steam: pixel-painted cards that rise, sway and fade */
function steam(top: number, r: number, seed = 1): { group: THREE.Group; tick: (t: number) => void } {
  const g = new THREE.Group();
  g.userData.noFit = true; // framing ignores the steam
  const t = new Tex(16, 32);
  for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
  for (let y = 0; y < 32; y++) {
    const cx = 8 + Math.sin(y * 0.35) * 3.2, w = 1.6 + Math.sin((y / 32) * Math.PI) * 1.8;
    for (let x = 0; x < 16; x++) { const d = Math.abs(x + 0.5 - cx); if (d < w && hash(x, y, 3) > 0.15) { t.set(x, y, rgb(0xfff6ea)); t.alpha(x, y, (1 - d / w) * Math.sin((y / 32) * Math.PI) * 0.9); } }
  }
  const map = smoothTex(pixelTex(new THREE.CanvasTexture(t.canvas()), { mips: false }));
  const wisps: { m: THREE.Mesh; o: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.7, r * 1.6), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: 0.5 }));
    m.renderOrder = 5;
    g.add(m);
    wisps.push({ m, o: i / 3 + hash(i, seed, 2) * 0.1 });
  }
  return {
    group: g, tick: (tt) => {
      for (const w of wisps) {
        const k = (tt * 0.35 + w.o) % 1;
        w.m.position.set(Math.sin(tt * 1.3 + w.o * 9) * r * 0.25 + (w.o - 0.33) * r * 0.6, top + r * 0.5 + k * r * 1.6, 0);
        (w.m.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
        w.m.scale.set(1 + k * 0.5, 1 + k * 0.3, 1);
      }
    },
  };
}

// ------------------------------------------------------------------ the drinks

const PORCELAIN: RGB = rgb(0xf4ede0), CLAY: RGB = rgb(0xb98a62);
/** a liquid surface painted in polar texture space (u around, p in from the rim): a darker rim ring, a lighter centre */
const liquid = (base: RGB, rimC: RGB, x: number, y: number, k: number) => mix3(rimC, base, cl(k * 3)) as RGB;

/** a cup handle: a D-shaped loop on the cup's right side (+x) */
function handle(r0: number, yTop: number, yBot: number, reach: number, thick: number) {
  return tube([V(r0 - thick, yTop, 0), V(r0 + reach * 0.55, yTop + thick * 0.4, 0), V(r0 + reach, (yTop + yBot) / 2 + thick, 0), V(r0 + reach * 0.75, yBot + thick * 0.3, 0), V(r0 - thick, yBot, 0)], thick, 0.72, 28, 10);
}
function saucer(R: number, col: (x: number, y: number, rim: boolean) => RGB, seed: number) {
  const { g, v } = turn([[0, 0], [R * 0.55, 0], [R * 0.6, R * 0.04], [R * 0.9, R * 0.12], [R, R * 0.18], [R * 0.97, R * 0.2], [R * 0.86, R * 0.15], [R * 0.6, R * 0.1], [R * 0.5, R * 0.11], [0, R * 0.11]], 48);
  const t = paintTurn(96, 48, v, (x, y, j) => col(x, y, j === 3 || j === 4 || j === 5));
  strokes(t, 0, 0, 96, 48, (x, y) => t.get(x, y), { seed, ang: 0, angJ: 0.3, len: 5, val: 0.06, hue: 0.4, wrap: true });
  return mesh(g, std({ map: tex(t), roughness: 0.22 }));
}

function espresso(): Prop {
  const o = new THREE.Group();
  const H = 0.056;
  const pts: [number, number][] = [[0, 0.012], [0.018, 0.012], [0.02, 0.014], [0.024, 0.022], [0.028, 0.038], [0.03, 0.05], [0.031, H + 0.008], [0.0295, H + 0.0095], [0.027, H + 0.007], [0.026, 0.05], [0, 0.05]];
  const { g, v } = turn(pts, 48);
  const crema = rgb(0xc98a4a), cremaD = rgb(0x7a4220);
  const t = paintTurn(128, 64, v, (x, y, j, p) => {
    if (j >= 9) { const k = (1 - (p - v[9]) / (1 - v[9])); const tiger = vnoise(x * 0.3, k * 9, 4) > 0.62 ? 0.18 : 0; return tint(liquid(crema, cremaD, x, y, k), tiger); }
    if (j === 0) return CLAY;
    if (j === 5 || j === 6 || j === 7) return j === 6 ? rgb(0xfbf6ec) : PORCELAIN;
    if (j === 4 && p > v[5] - 0.03) return rgb(0x2a4a8a); // a cobalt line under the rim
    return PORCELAIN;
  });
  strokes(t, 0, 0, 128, 64, (x, y) => t.get(x, y), { seed: 3, ang: 0, angJ: 0.25, len: 6, val: 0.08, hue: 0.6, wrap: true });
  const cup = mesh(g, std({ map: tex(t), roughness: 0.18 }));
  const hm = mesh(handle(0.027, 0.046, 0.024, 0.018, 0.0038), std({ color: 0xf2ebde, roughness: 0.2 }));
  const sauc = saucer(0.05, (x, y, rim) => (rim && vnoise(x * 0.4, y, 2) > 0.2 ? rgb(0x2a4a8a) : PORCELAIN), 5);
  // a little spoon resting on the saucer
  const spoon = new THREE.Group();
  const bowl = mesh(turn([[0, 0], [0.006, 0.0008], [0.0085, 0.003], [0.0088, 0.0034]], 16).g, std({ color: 0xd8d2c4, metalness: 0.9, roughness: 0.25 }));
  bowl.scale.set(1, 1, 1.45);
  const stem = mesh(tube([V(0, 0.003, 0.012), V(0.002, 0.006, 0.035), V(0.003, 0.007, 0.058)], 0.0016, 0.45, 12, 6), std({ color: 0xd8d2c4, metalness: 0.9, roughness: 0.25 }));
  spoon.add(bowl, stem);
  spoon.position.set(-0.034, 0.011, 0.014); spoon.rotation.y = -1.3; spoon.scale.setScalar(0.8);
  const st = steam(H + 0.01, 0.024, 2);
  o.add(sauc, cup, hm, spoon, st.group);
  return { obj: o, tick: st.tick };
}

function coffeeMug(): Prop {
  const o = new THREE.Group();
  const R = 0.042, H = 0.096;
  const pts: [number, number][] = [[0, 0.003], [0.034, 0.002], [0.038, 0], [0.041, 0.006], [0.042, 0.02], [0.0425, 0.05], [0.0425, 0.08], [0.042, H - 0.002], [0.0405, H], [0.0385, H - 0.001], [0.037, H - 0.012], [0.037, H - 0.016], [0, H - 0.016]];
  const { g, v } = turn(pts, 56);
  // a two-tone stoneware glaze: deep blue over oat, the blue running down in drips, an unglazed clay foot
  const blue = rgb(0x2f5f8f), blueD = rgb(0x1f3c66), oat = rgb(0xe8d9bc), cof = rgb(0x3a1e0e), cofE = rgb(0x8a5a32);
  const t = paintTurn(160, 96, v, (x, y, j, p) => {
    if (j >= 11) { const k = 1 - (p - v[11]) / (1 - v[11]); return liquid(cof, cofE, x, y, k); }
    if (j <= 1) return tint(CLAY, -0.1);
    if (j === 2) return CLAY;
    if (j >= 8) return j === 8 ? rgb(0xc9a77a) : tint(oat, -0.05); // the rubbed rim and the glazed inside
    const drip = 0.55 + Math.max(0, Math.sin(x * 0.42 + hash(x >> 2, 1, 3) * 3)) * 0.18 + hash(x >> 1, 2, 4) * 0.05;
    const q = (p - v[2]) / (v[8] - v[2]);
    if (q > 1 - drip * 0.62) return mix3(blueD, blue, cl((q - (1 - drip * 0.62)) * 6));
    return oat;
  });
  strokes(t, 0, 0, 160, 96, (x, y) => t.get(x, y), { seed: 9, ang: Math.PI / 2, angJ: 0.4, len: 5, val: 0.1, hue: 0.7, wrap: true, n: 3000 });
  // speckles in the stoneware
  for (let i = 0; i < 260; i++) { const x = (hash(i, 1, 9) * 160) | 0, y = (hash(i, 2, 9) * 96) | 0; if (y > 20) t.shade(x, y, 0.7); }
  const mug = mesh(g, std({ map: tex(t), roughness: 0.3 }));
  const ht = new Tex(32, 16, blue);
  wash(ht, 0, 0, 32, 16, (x) => (x > 6 && x < 26 ? blue : blueD), { seed: 4, ang: 0, len: 4 });
  const hm = mesh(handle(R, 0.078, 0.026, 0.026, 0.0065), std({ map: tex(ht), roughness: 0.3 }));
  const st = steam(H, 0.034, 1);
  o.add(mug, hm, st.group);
  return { obj: o, tick: st.tick };
}

function teaCup(): Prop {
  const o = new THREE.Group();
  const pts: [number, number][] = [[0, 0.012], [0.02, 0.012], [0.023, 0.014], [0.026, 0.018], [0.034, 0.028], [0.042, 0.046], [0.047, 0.06], [0.0485, 0.064], [0.047, 0.065], [0.0445, 0.061], [0.04, 0.05], [0, 0.05]];
  const { g, v } = turn(pts, 56);
  const tea = rgb(0xa8541a), teaE = rgb(0x6a3010), gold = rgb(0xd9ae4a);
  const t = paintTurn(192, 96, v, (x, y, j, p) => {
    if (j >= 10) { const k = 1 - (p - v[10]) / (1 - v[10]); return liquid(tint(tea, 0.15), teaE, x, y, k); }
    if (j === 1 || j === 6 || j === 7) return gold;
    if (j === 0) return CLAY;
    return PORCELAIN;
  });
  // a hand-painted band of roses and leaves round the outside
  const bandY0 = Math.round((1 - v[5]) * 96), bandY1 = Math.round((1 - v[4]) * 96);
  for (let i = 0; i < 9; i++) {
    const cx = (i + 0.5) * (192 / 9) + hash(i, 1, 2) * 4, cy = (bandY0 + bandY1) / 2 + (hash(i, 2, 2) - 0.5) * 3;
    for (const [dx, dy] of [[-5, 1], [5, -1]]) blob(t, cx + dx, cy + dy, 3, rgb(0x4f7a3a), 1, 1.6);
    blob(t, cx, cy, 3.4, (x, y) => mix3(rgb(0xc8455a), rgb(0xf0a0b0), vnoise(x * 0.8, y * 0.8, i)));
    t.set(cx | 0, cy | 0, rgb(0x8a1f33));
  }
  strokes(t, 0, 0, 192, 96, (x, y) => t.get(x, y), { seed: 12, ang: 0, angJ: 0.4, len: 4, val: 0.07, hue: 0.5, wrap: true, n: 2600 });
  const cup = mesh(g, std({ map: tex(t), roughness: 0.18 }));
  const hm = mesh(handle(0.042, 0.055, 0.03, 0.018, 0.0035), std({ color: 0xf3ecdf, roughness: 0.2 }));
  const sauc = saucer(0.064, (x, y, rim) => (rim ? (y % 8 < 2 ? gold : PORCELAIN) : PORCELAIN), 6);
  // the tea bag's string over the rim and its paper tag
  const str = mesh(tube([V(0.01, 0.05, 0.0), V(0.03, 0.062, 0.02), V(0.044, 0.066, 0.03), V(0.05, 0.05, 0.035), V(0.051, 0.03, 0.036)], 0.0006, 1, 20, 4), std({ color: 0xe8dcc0, roughness: 1 }));
  const tt = new Tex(32, 40); // [font6] 2 texels per mm so 'tea' fits in Alagard
  wash(tt, 0, 0, 32, 40, () => rgb(0xf0e2c2), { seed: 2, len: 2 });
  for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) if (x < 2 || y < 2 || x > 29 || y > 37) tt.shade(x, y, 0.85);
  letter(tt, 'tea', 16, 25, F.small(16), rgb(0x3a6a2a));
  const tag = mesh(new THREE.PlaneGeometry(0.016, 0.02), std({ map: tex(tt), side: THREE.DoubleSide, roughness: 0.9 }), false);
  tag.position.set(0.0515, 0.022, 0.037); tag.rotation.y = 0.5;
  const st = steam(0.066, 0.034, 3);
  o.add(sauc, cup, hm, str, tag, st.group);
  return { obj: o, tick: st.tick };
}

/** a drinks can: aluminium ends, a painted wrap-round label */
function can(o: { r: number; h: number; label: (t: Tex, y0: number, y1: number) => void; seed: number }): Prop {
  const { r, h } = o, grp = new THREE.Group();
  const pts: [number, number][] = [[0, 0.007], [r * 0.6, 0.0045], [r * 0.72, 0], [r * 0.85, 0.001], [r * 0.97, 0.007], [r, 0.012], [r, h - 0.014], [r * 0.93, h - 0.006], [r * 0.83, h - 0.002], [r * 0.84, h], [r * 0.8, h], [r * 0.78, h - 0.003], [0, h - 0.003]];
  const { g, v } = turn(pts, 48);
  const W = 192, H = 192, silver = rgb(0xc8ccd2);
  const t = paintTurn(W, H, v, () => silver);
  // brushed aluminium on the ends
  strokes(t, 0, 0, W, H, (x, y) => t.get(x, y), { seed: o.seed, ang: 0, angJ: 0.05, len: 10, val: 0.12, hue: 0.2, wrap: true, n: 3000 });
  const y0 = Math.round((1 - v[6]) * H), y1 = Math.round((1 - v[5]) * H);
  o.label(t, y0, y1);
  // scuffs: the print rubbed through to metal along the top and bottom of the label
  wear(t, (x, y) => (y >= y0 && y < y1 ? Math.max(0, 1 - Math.min(y - y0, y1 - 1 - y) / 5) : 0), { seed: o.seed, chip: silver, k: 0.25 });
  const body = mesh(g, std({ map: tex(t), metalness: 0.55, roughness: 0.32 }));
  // the lid: the opening's score line, the rivet and the ring pull
  const lt = new Tex(48, 48);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const d = Math.hypot(x - 23.5, y - 23.5), a = Math.atan2(y - 23.5, x - 23.5);
    let c = tint(silver, (Math.sin(a * 40 + d) * 0.03) + (hash(x, y, 2) - 0.5) * 0.08);
    if (d > 21) c = tint(silver, -0.15);
    if (Math.abs(Math.hypot((x - 23.5) / 1.3, y - 12) - 6) < 0.7 && y < 20) c = tint(silver, -0.3);
    lt.set(x, y, c); lt.alpha(x, y, d < 23.5 ? 1 : 0);
  }
  const lid = mesh(new THREE.CircleGeometry(r * 0.78, 32), std({ map: tex(lt), metalness: 0.8, roughness: 0.3, transparent: true, alphaTest: 0.5 }), false);
  lid.rotation.x = -Math.PI / 2; lid.position.y = h - 0.0028;
  const tabS = new THREE.Shape();
  tabS.absellipse(0, 0, r * 0.22, r * 0.34, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path(); hole.absellipse(0, -r * 0.08, r * 0.12, r * 0.13, 0, Math.PI * 2, false, 0); tabS.holes.push(hole);
  const tab = mesh(new THREE.ExtrudeGeometry(tabS, { depth: 0.0008, bevelEnabled: false, curveSegments: 16 }), std({ color: 0xb8bcc4, metalness: 0.9, roughness: 0.28 }));
  tab.rotation.x = -Math.PI / 2; tab.position.set(0, h - 0.0018, r * 0.12);
  grp.add(body, lid, tab);
  return { obj: grp };
}
function sodaCan(): Prop {
  return can({ r: 0.033, h: 0.122, seed: 21, label: (t, y0, y1) => {
    const red = rgb(0xc8282e), cream = rgb(0xf4e6c8), W = t.w;
    wash(t, 0, y0, W, y1 - y0, (x, y) => { const q = (y - y0) / (y1 - y0), wave = 0.62 + Math.sin((x / W) * Math.PI * 4) * 0.06; return Math.abs(q - wave) < 0.05 ? cream : red; }, { seed: 4, ang: 0, len: 6, wrap: true, n: 3600, val: 0.14 });
    // bubbles
    for (let i = 0; i < 40; i++) { const x = hash(i, 3, 4) * W, y = y0 + 4 + hash(i, 4, 4) * (y1 - y0) * 0.5; blob(t, x, y, 1 + hash(i, 5, 4) * 1.5, tint(cream, -0.05), 0.85); }
    const mid = y0 + (y1 - y0) * 0.42;
    letter(t, 'Fizz', W * 0.5, mid + 8, F.hand(32), cream, { outline: rgb(0x5a0e12) });
    letter(t, 'COLA', W * 0.5, mid + 30, F.caps(12), rgb(0x5a0e12));
  } });
}
function energyCan(): Prop {
  return can({ r: 0.0265, h: 0.168, seed: 23, label: (t, y0, y1) => {
    const navy = rgb(0x14183a), lime = rgb(0xb6f23a), W = t.w;
    wash(t, 0, y0, W, y1 - y0, (x, y) => { const q = (y - y0) / (y1 - y0); return q > 0.86 || q < 0.06 ? lime : navy; }, { seed: 5, ang: Math.PI / 2, len: 6, wrap: true, n: 4000, val: 0.16, hue: 1 });
    // a jagged lightning bolt down the front
    const cx = W * 0.5, top = y0 + 14, bot = y1 - 20;
    const zig = [[cx + 10, top], [cx - 6, top + (bot - top) * 0.45], [cx + 5, top + (bot - top) * 0.48], [cx - 10, bot]];
    for (let i = 0; i < zig.length - 1; i++) for (let s = 0; s <= 40; s++) { const k = s / 40, x = zig[i][0] + (zig[i + 1][0] - zig[i][0]) * k, y = zig[i][1] + (zig[i + 1][1] - zig[i][1]) * k; blob(t, x, y, 3.2, (px, py) => tint(lime, (hash(px, py, 1) - 0.5) * 0.2)); }
    letter(t, 'ZAP!', cx, y0 + (y1 - y0) * 0.36, F.caps(12), rgb(0xffffff), { outline: rgb(0x0a0c1e) });
    letter(t, 'ZAP!', cx + 1, y0 + (y1 - y0) * 0.36, F.caps(12), rgb(0xffffff));
  } });
}
function cocoa(): Prop {
  const o = new THREE.Group();
  const H = 0.086;
  const pts: [number, number][] = [[0, 0.003], [0.036, 0.002], [0.039, 0], [0.044, 0.006], [0.046, 0.03], [0.046, 0.07], [0.0455, H - 0.002], [0.044, H], [0.042, H - 0.002], [0.041, H - 0.01], [0, H - 0.01]];
  const { g, v } = turn(pts, 56);
  const red = rgb(0xb2312e), cream = rgb(0xf3e4c6);
  const t = paintTurn(160, 96, v, (x, y, j, p) => {
    if (j >= 9) return rgb(0x5a2e16);
    if (j <= 1) return CLAY;
    if (j === 7) return cream;
    // a red mug with a hand-painted cream heart-and-dot band
    const q = (p - v[2]) / (v[7] - v[2]);
    if (q > 0.45 && q < 0.62) return cream;
    return red;
  });
  const by = Math.round((1 - (v[2] + (v[7] - v[2]) * 0.535)) * 96);
  for (let i = 0; i < 10; i++) { const cx = (i + 0.5) * 16; if (i % 2) { blob(t, cx - 1.5, by - 1, 2, red); blob(t, cx + 1.5, by - 1, 2, red); for (let k = 0; k < 4; k++) t.set(cx - 3 + k + (k > 1 ? 1 : 0), by + k - 0, red); for (let d = 0; d < 3; d++) t.set(cx - 2 + d, by + 1 + (d === 1 ? 1 : 0), red); } else blob(t, cx, by, 1.4, rgb(0x2f6a3a)); }
  strokes(t, 0, 0, 160, 96, (x, y) => t.get(x, y), { seed: 13, ang: Math.PI / 2, angJ: 0.5, len: 4, val: 0.1, hue: 0.7, wrap: true, n: 2600 });
  const mug = mesh(g, std({ map: tex(t), roughness: 0.28 }));
  const hm = mesh(handle(0.046, 0.07, 0.024, 0.024, 0.006), std({ color: 0xa42c2a, roughness: 0.28 }));
  // whipped cream: three soft tiers, cocoa dusted, a chocolate drizzle
  const cp: [number, number][] = [[0.041, H - 0.012], [0.042, H - 0.002], [0.038, H + 0.006], [0.03, H + 0.01], [0.031, H + 0.014], [0.024, H + 0.02], [0.016, H + 0.022], [0.017, H + 0.026], [0.01, H + 0.032], [0.003, H + 0.038], [0, H + 0.039]];
  const c = turn(cp, 40);
  const ct = paintTurn(96, 64, c.v, (x, y) => tint(rgb(0xfbf5ea), (hash(x, y, 2) - 0.5) * 0.06));
  strokes(ct, 0, 0, 96, 64, (x, y) => ct.get(x, y), { seed: 4, ang: 0.6, len: 5, val: 0.08, hue: 0.4, wrap: true });
  for (let i = 0; i < 140; i++) ct.set(hash(i, 1, 6) * 96, hash(i, 2, 6) * 50, rgb(0x6a3a1c), 0.8);
  for (let x = 0; x < 96; x++) { const y = 22 + Math.round(Math.sin(x * 0.2) * 6 + Math.sin(x * 0.07) * 4); ct.set(x, y, rgb(0x4a220e)); ct.set(x, y + 1, rgb(0x5a2e16)); }
  const creamM = mesh(c.g, std({ map: tex(ct), roughness: 0.75 }));
  // the cream's swirl: wobble the tiers a little so it is not a perfect turning
  const pp = creamM.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), a = Math.atan2(z, x), y = pp.getY(i); const k = 1 + Math.sin(a * 5 + y * 400) * 0.06; pp.setXYZ(i, x * k, y, z * k); }
  creamM.geometry.computeVertexNormals();
  const mallow = std({ color: 0xfff4ec, roughness: 0.85 });
  for (const [x, z, ry] of [[0.03, 0.014, 0.4], [-0.024, 0.022, 1.2], [0.006, -0.03, 2.2]]) {
    const m = mesh(new RoundedBoxGeometry(0.012, 0.01, 0.012, 2, 0.0035), mallow);
    m.position.set(x, H + 0.008, z); m.rotation.set(0.3, ry, 0.2);
    o.add(m);
  }
  const st = steam(H + 0.03, 0.03, 4);
  o.add(mug, hm, creamM, st.group);
  return { obj: o, tick: st.tick };
}
function waterGlass(): Prop {
  const o = new THREE.Group();
  const H = 0.11;
  const gp: [number, number][] = [[0, 0.006], [0.028, 0.006], [0.03, 0], [0.032, 0.002], [0.037, H - 0.002], [0.0375, H], [0.0355, H], [0.0335, 0.009], [0, 0.009]];
  // [dialog10] clear glass and clear water (they read as milk before): thin reflections, a cool tint
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xeaf6f6, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, envMapIntensity: 0.8, depthWrite: false });
  const gm = mesh(turn(gp, 48).g, glass, false);
  gm.renderOrder = 4;
  const wp: [number, number][] = [[0, 0.009], [0.0334, 0.009], [0.0362, H * 0.78], [0, H * 0.78]];
  const wt = new Tex(32, 32);
  wash(wt, 0, 0, 32, 32, (x, y) => (y < 4 ? rgb(0xb8e6f2) : rgb(0x3a98c4)), { seed: 3, ang: Math.PI / 2, len: 6 });
  const water = mesh(turn(wp, 40).g, new THREE.MeshStandardMaterial({ map: tex(wt), roughness: 0.04, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 0.5 }), false);
  water.renderOrder = 3;
  // two ice cubes and a lemon slice on the rim
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, roughness: 0.15, transparent: true, opacity: 0.42, depthWrite: false });
  for (const [x, y, z, r] of [[0.01, H * 0.74, 0.006, 0.4], [-0.012, H * 0.72, -0.008, 1.1]]) { const c = mesh(new RoundedBoxGeometry(0.018, 0.016, 0.018, 2, 0.004), ice, false); c.position.set(x, y, z); c.rotation.set(0.3, r, 0.2); c.renderOrder = 3; o.add(c); }
  const lt = new Tex(48, 48);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const d = Math.hypot(x - 23.5, y - 23.5) / 23.5, a = Math.atan2(y - 23.5, x - 23.5);
    let c: RGB = d > 0.9 ? rgb(0xe8c81a) : d > 0.82 ? rgb(0xfbf2d0) : mix3(rgb(0xf8e070), rgb(0xfff4b0), vnoise(x * 0.5, y * 0.5, 2));
    if (d < 0.82 && (Math.abs(Math.sin(a * 4.5)) < 0.08 || d < 0.1)) c = rgb(0xfbf2d0);
    lt.set(x, y, c); lt.alpha(x, y, d <= 1 ? 1 : 0);
  }
  const lemon = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.004, 32), [std({ color: 0xe8c81a, roughness: 0.5 }), std({ map: tex(lt), roughness: 0.4 }), std({ map: tex(lt), roughness: 0.4 })]);
  lemon.position.set(0.03, H - 0.004, 0.0); lemon.rotation.set(0, 0, 1.25);
  o.add(water, lemon, gm);
  return { obj: o };
}

export const DRINKS: { v: string; label: string; caffeine: boolean; build: () => Prop }[] = [
  { v: 'espresso', label: 'Espresso', caffeine: true, build: espresso },
  { v: 'coffee', label: 'Coffee', caffeine: true, build: coffeeMug },
  { v: 'tea', label: 'Tea', caffeine: true, build: teaCup },
  { v: 'soda', label: 'Cola', caffeine: true, build: sodaCan },
  { v: 'energy', label: 'Energy', caffeine: true, build: energyCan },
  { v: 'cocoa', label: 'Cocoa', caffeine: false, build: cocoa },
  { v: 'water', label: 'Water', caffeine: false, build: waterGlass },
];

// ------------------------------------------------------------------ cassette tapes

export interface Tape { id: string; title: string; shell: RGB; label: RGB; stripe: RGB[]; pic: (t: Tex, x: number, y: number, w: number, h: number) => void }
const sky = (t: Tex, x: number, y: number, w: number, h: number, top: RGB, bot: RGB) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) t.set(x + i, y + j, tint(mix3(top, bot, j / h), (hash(i, j, 3) - 0.5) * 0.1)); };
export const TAPES: Tape[] = [
  { id: 'rain', title: 'Rain', shell: rgb(0x3c4450), label: rgb(0xdfe6ea), stripe: [rgb(0x4a78a8), rgb(0x8ab0d0)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x5a6a80), rgb(0x9aaabd));
    blob(t, x + w * 0.4, y + h * 0.32, w * 0.28, rgb(0xe6ecf2), 1, h * 0.16); blob(t, x + w * 0.62, y + h * 0.3, w * 0.22, rgb(0xd0d8e2), 1, h * 0.14);
    for (let i = 0; i < 14; i++) { const rx = x + 2 + hash(i, 1, 7) * (w - 4), ry = y + h * 0.5 + hash(i, 2, 7) * h * 0.3; t.set(rx, ry, rgb(0x2a4a8a)); t.set(rx - 1, ry + 1, rgb(0x4a78c8)); }
  } },
  { id: 'waves', title: 'Waves', shell: rgb(0xe8e2d4), label: rgb(0xf2ead8), stripe: [rgb(0x1f7a8a), rgb(0x5ab0b8)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h * 0.5, rgb(0xf0b070), rgb(0xf8d8a0));
    blob(t, x + w * 0.7, y + h * 0.42, 3, rgb(0xfff0c0));
    for (let j = Math.floor(h * 0.5); j < h; j++) for (let i = 0; i < w; i++) { const crest = Math.sin(i * 0.6 + j * 0.9) > 0.7; t.set(x + i, y + j, crest ? rgb(0xe8f6f4) : mix3(rgb(0x2a8a9a), rgb(0x175a70), (j - h * 0.5) / (h * 0.5))); }
  } },
  { id: 'forest', title: 'Forest', shell: rgb(0x2e3a2a), label: rgb(0xe6e2c8), stripe: [rgb(0x2f6a3a), rgb(0x7aa25a)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x16224a), rgb(0x34507a));
    blob(t, x + w * 0.75, y + h * 0.25, 2.4, rgb(0xfff2c8));
    for (const [px, ph] of [[0.2, 0.8], [0.45, 0.95], [0.7, 0.75], [0.92, 0.6]]) for (let j = 0; j < h * ph; j++) { const hw = (j / (h * ph)) * w * 0.14 + 0.5; for (let i = -hw; i <= hw; i++) t.set(x + w * px + i, y + h - h * ph + j, (j + Math.round(i)) % 3 ? rgb(0x1f4a2a) : rgb(0x2f6a3a)); }
  } },
  { id: 'fire', title: 'Fire', shell: rgb(0x8a2a1c), label: rgb(0xf4e4c4), stripe: [rgb(0xd8641e), rgb(0xf0b030)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x241418), rgb(0x3a2018));
    for (let j = 0; j < h * 0.7; j++) { const q = j / (h * 0.7), hw = (1 - q) * w * 0.3; for (let i = -hw; i <= hw; i++) { const c = Math.abs(i) < hw * 0.4 ? rgb(0xffe080) : Math.abs(i) < hw * 0.75 ? rgb(0xf09030) : rgb(0xc83a1a); t.set(x + w / 2 + i + Math.sin(j * 0.8) * 1.2, y + h * 0.85 - j, c); } }
    for (let i = -w * 0.35; i < w * 0.35; i++) { t.set(x + w / 2 + i, y + h * 0.88, rgb(0x5a3418)); t.set(x + w / 2 + i, y + h * 0.88 + 1, rgb(0x3a2010)); }
  } },
  { id: 'stream', title: 'Stream', shell: rgb(0x3a6a72), label: rgb(0xe8eee2), stripe: [rgb(0x3a9ab0), rgb(0x9ad0c8)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x6aa04a), rgb(0x4a8038));
    for (let j = 0; j < h; j++) { const cx = w * 0.5 + Math.sin(j * 0.3) * w * 0.15, hw = w * 0.12 + j * 0.15; for (let i = -hw; i <= hw; i++) t.set(x + cx + i, y + j, (i + j) % 5 === 0 ? rgb(0xd8f0f0) : rgb(0x4aa0c0)); }
    blob(t, x + w * 0.3, y + h * 0.7, 2.5, rgb(0x8a8a80)); blob(t, x + w * 0.72, y + h * 0.4, 2, rgb(0x9a9488));
  } },
  { id: 'wind', title: 'Wind', shell: rgb(0xd8d4cc), label: rgb(0xf4f0e8), stripe: [rgb(0x8aa0b8), rgb(0xc8d4e0)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x8ab8e0), rgb(0xc8e0f0));
    for (let k = 0; k < 3; k++) { const yy = y + h * (0.3 + k * 0.22); for (let i = 0; i < w * 0.8; i++) { const a = i / (w * 0.8); t.set(x + w * 0.1 + i, yy + Math.sin(a * 6 + k) * 1.5, rgb(0xffffff)); } t.set(x + w * 0.9, yy - 1, rgb(0xffffff)); }
  } },
  { id: 'brown', title: 'Brown noise', shell: rgb(0x5a3a24), label: rgb(0xe8d6b4), stripe: [rgb(0x8a5a30), rgb(0xc89a5a)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x3a2414), rgb(0x2a1a10));
    for (let i = 0; i < w; i += 2) { const bh = (0.25 + vnoise(i * 0.3, 1, 4) * 0.6) * h; for (let j = 0; j < bh; j++) { t.set(x + i, y + h - 1 - j, mix3(rgb(0xc89a5a), rgb(0xf0d08a), j / bh)); } }
  } },
  { id: 'lullaby', title: 'Lullaby', shell: rgb(0xe0a8b4), label: rgb(0xfaeef0), stripe: [rgb(0xd87890), rgb(0xf0b8c4)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x2a2a6a), rgb(0x4a3a8a));
    blob(t, x + w * 0.35, y + h * 0.45, h * 0.28, rgb(0xfff0b0)); blob(t, x + w * 0.42, y + h * 0.4, h * 0.25, rgb(0x2e2e70));
    for (const [nx, ny] of [[0.68, 0.35], [0.82, 0.55]]) { blob(t, x + w * nx, y + h * ny, 1.6, rgb(0xf0c0d0)); for (let j = 1; j < 6; j++) t.set(x + w * nx + 1.4, y + h * ny - j, rgb(0xf0c0d0)); }
  } },
  { id: 'night', title: 'Crickets', shell: rgb(0x26285a), label: rgb(0xe4e6f2), stripe: [rgb(0x4a4a9a), rgb(0x9a9ad8)], pic: (t, x, y, w, h) => {
    sky(t, x, y, w, h, rgb(0x101838), rgb(0x203060));
    for (let i = 0; i < 8; i++) t.set(x + hash(i, 1, 3) * w, y + hash(i, 2, 3) * h * 0.5, rgb(0xfff4c0));
    for (let i = 0; i < w; i++) { const gh = 2 + hash(i, 4, 3) * h * 0.3; for (let j = 0; j < gh; j++) t.set(x + i, y + h - 1 - j, j % 2 ? rgb(0x2a5a2a) : rgb(0x1e4420)); }
    blob(t, x + w * 0.5, y + h * 0.62, 3, rgb(0x5a7a2a), 1, 1.6); t.set(x + w * 0.5 + 3, y + h * 0.62 - 3, rgb(0x5a7a2a)); t.set(x + w * 0.5 + 4, y + h * 0.62 - 4, rgb(0x5a7a2a));
  } },
];

/** a tape's painted face and plastic sides (painted once per tape) */
const tapeMats = new Map<string, [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]>();
function tapeFace(tp: Tape): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  const H = 0.064, hubX = 0.021, hubY = 0.006;
  // the face: 2 texels per mm
  const TW = 200, TH = 128, mm = (x: number) => x * 2;
  const t = new Tex(TW, TH);
  wash(t, 0, 0, TW, TH, () => tp.shell, { seed: tp.id.length * 7, ang: 0, angJ: 0.2, len: 6, val: 0.1, hue: 0.4, n: 4000 });
  // the paper label (top three quarters), the window cut out of it
  const L = { x0: mm(6), y0: mm(4), x1: mm(94), y1: mm(44) }, Wn = { x0: mm(30), y0: mm(17), x1: mm(70), y1: mm(33) };
  const inWin = (x: number, y: number) => x >= Wn.x0 && x < Wn.x1 && y >= Wn.y0 && y < Wn.y1 && !((x - Wn.x0 < 3 || Wn.x1 - 1 - x < 3) && (y - Wn.y0 < 3 || Wn.y1 - 1 - y < 3));
  wash(t, L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0, (x, y) => (inWin(x, y) ? null : tp.label), { seed: 31, ang: 0.1, len: 5, val: 0.07, hue: 0.5, n: 1800 });
  // retro stripes across the bottom of the label
  for (let y = L.y0 + mm(35); y < L.y1; y++) for (let x = L.x0; x < L.x1; x++) t.set(x, y, tint(tp.stripe[(y - (L.y0 + mm(35))) < 5 ? 0 : 1], (hash(x, y, 4) - 0.5) * 0.12));
  // ruled lines and the hand-written title on the top strip
  for (let x = L.x0 + 4; x < L.x1 - 4; x++) if (hash(x, 9, 2) > 0.2) t.set(x, L.y0 + mm(11.5), tint(tp.stripe[0], 0.2), 0.7);
  letter(t, tp.title, (L.x0 + L.x1) / 2 + 6, L.y0 + mm(10), F.hand(16), rgb(0x1d2552), { jit: 0.3 });
  letter(t, 'A', L.x0 + mm(4), L.y0 + mm(8), F.caps(16), tp.stripe[0]);
  letter(t, 'C60', L.x1 - mm(8), L.y0 + mm(30), F.small(16), rgb(0x5a5f80));
  // the little cover picture, framed, left of the window
  const P = { x: L.x0 + mm(4), y: Wn.y0 - 2, w: mm(21), h: Wn.y1 - Wn.y0 + 4 };
  tp.pic(t, P.x, P.y, P.w, P.h);
  for (let x = P.x - 1; x <= P.x + P.w; x++) { t.set(x, P.y - 1, rgb(0x3a3020)); t.set(x, P.y + P.h, rgb(0x3a3020)); }
  for (let y = P.y - 1; y <= P.y + P.h; y++) { t.set(P.x - 1, y, rgb(0x3a3020)); t.set(P.x + P.w, y, rgb(0x3a3020)); }
  // the window: smoked plastic, the wound tape packs round the hubs, a glint
  const hx = (s: number) => TW / 2 + s * mm(hubX * 1000), hy = TH / 2 - mm(hubY * 1000);
  for (let y = Wn.y0; y < Wn.y1; y++) for (let x = Wn.x0; x < Wn.x1; x++) {
    if (!inWin(x, y)) continue;
    let c = tint(rgb(0x2a2622), (hash(x, y, 8) - 0.5) * 0.15);
    for (const [s, r] of [[-1, mm(11)], [1, mm(7)]] as const) { const d = Math.hypot(x - hx(s), y - hy); if (d < r) c = tint(rgb(0x5a3418), Math.sin(d * 2.2) * 0.06 + (d > r - 1.5 ? -0.25 : 0)); }
    if (Math.abs((x - Wn.x0) - (y - Wn.y0) * 1.4 - 14) < 2.5) c = tint(c, 0.5);
    t.set(x, y, c);
  }
  for (let y = Wn.y0; y < Wn.y1; y++) for (let x = Wn.x0; x < Wn.x1; x++) if (inWin(x, y) && !inWin(x - 1, y) || inWin(x, y) && !inWin(x, y - 1)) t.shade(x, y, 0.6);
  // screws, worn corners
  for (const [sx, sy] of [[mm(3), mm(3)], [TW - mm(3), mm(3)], [mm(3), TH - mm(3)], [TW - mm(3), TH - mm(3)], [TW / 2, TH - mm(5)]]) { blob(t, sx, sy, 2.2, rgb(0x9a9a9a)); t.set(sx - 1, sy, rgb(0x404040)); t.set(sx, sy, rgb(0x404040)); t.set(sx + 1, sy, rgb(0x404040)); }
  wear(t, (x, y) => Math.max(0, 1 - Math.min(x, y, TW - 1 - x, TH - 1 - y) / 4), { seed: 5, k: 0.25 });
  wear(t, (x, y) => (x >= L.x0 && x < L.x1 && y >= L.y0 && y < L.y1 ? Math.max(0, 1 - Math.min(x - L.x0, y - L.y0, L.x1 - 1 - x, L.y1 - 1 - y) / 3) : 0), { seed: 8, k: -0.12 });
  // the raised trapezoid along the bottom: darker plastic, its five openings (pinch roller, capstans, head)
  for (let y = TH - mm(14.5); y < TH; y++) { const q = (TH - y) / mm(14.5), hw = mm(31) - q * mm(5); for (let x = TW / 2 - hw; x < TW / 2 + hw; x++) t.shade(x, y, 0.82); }
  for (const ox of [-22, -11, 0, 11, 22]) { const cx = TW / 2 + mm(ox), cy = TH - mm(4); for (let y = -3; y <= 3; y++) for (let x = -(ox === 0 ? 5 : 3); x <= (ox === 0 ? 5 : 3); x++) t.set(cx + x, cy + y, ox === 0 ? rgb(0x3a2418) : rgb(0x141210)); }
  const faceM = std({ map: tex(t), roughness: 0.42 });
  const st = new Tex(32, 8, tp.shell);
  wash(st, 0, 0, 32, 8, () => tp.shell, { seed: 2, len: 5 });
  const sideM = std({ map: tex(st, { repeat: true }), roughness: 0.45 });
  return [faceM, sideM];
}

/** A compact cassette (100 x 64 x 12 mm), standing on its long edge, facing +z. Its two hubs turn (`spin`). */
export function cassette(tp: Tape): Prop & { hubs: THREE.Object3D[]; spin: number } {
  const g = new THREE.Group();
  const W = 0.1, H = 0.064, D = 0.012, hubX = 0.021, hubY = 0.006, hubR = 0.0046;
  const sh = rrShape(W, H, 0.004);
  const mats = tapeMats.get(tp.id) ?? tapeFace(tp);
  tapeMats.set(tp.id, mats);
  const [faceM, sideM] = mats;
  for (const sx of [-1, 1]) { const p = new THREE.Path(); p.absarc(sx * hubX, hubY, hubR, 0, Math.PI * 2, true); sh.holes.push(p); }
  const bounds = { x0: -W / 2, y0: -H / 2, w: W, h: H };
  const body = mesh(slab(sh, D - 0.0016, 0.0008, bounds, 30, 10), [faceM, sideM]);
  // the raised trapezoid along the bottom (the tape guides), mapped onto the same face painting
  const tz = new THREE.Shape();
  tz.moveTo(-0.031, -H / 2 + 0.0005); tz.lineTo(0.031, -H / 2 + 0.0005); tz.lineTo(0.026, -H / 2 + 0.0145); tz.lineTo(-0.026, -H / 2 + 0.0145); tz.closePath();
  const trap = mesh(slab(tz, D + 0.0012, 0.0004, bounds, 30, 4), [faceM, sideM]);
  // the hubs: white toothed rings inside the holes
  const hubs: THREE.Object3D[] = [];
  const gear = new THREE.Shape();
  for (let i = 0; i <= 36; i++) { const a = (i / 36) * Math.PI * 2, r = hubR * (i % 6 < 3 ? 0.98 : 0.86); if (i === 0) gear.moveTo(Math.cos(a) * r, Math.sin(a) * r); else gear.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  const gh = new THREE.Path(); gh.absarc(0, 0, hubR * 0.62, 0, Math.PI * 2, true); gear.holes.push(gh);
  const gearG = new THREE.ExtrudeGeometry(gear, { depth: D * 0.7, bevelEnabled: false, curveSegments: 4 });
  gearG.translate(0, 0, -D * 0.35);
  const hubM = std({ color: 0xf2efe6, roughness: 0.5 });
  const backing = std({ color: 0x5a3418, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const hg = new THREE.Group();
    hg.add(mesh(gearG, hubM));
    const core = mesh(new THREE.CircleGeometry(hubR, 16), backing, false);
    core.position.z = -D * 0.3;
    hg.add(core);
    hg.position.set(sx * hubX, hubY, 0);
    hubs.push(hg); g.add(hg);
  }
  g.add(body, trap);
  g.position.y = H / 2;
  const root = new THREE.Group();
  root.add(g);
  const self = { obj: root, hubs, spin: 0, tick: (_t: number, dt: number) => { if (self.spin) for (const h of hubs) h.rotation.z -= dt * self.spin; } };
  return self;
}

// ------------------------------------------------------------------ the cassette recorder

export interface Deck extends Prop { door: THREE.Group; bay: THREE.Group; keys: THREE.Object3D[]; needle: THREE.Object3D; cone: THREE.Object3D; playing: boolean; doorOpen: number; bayAnchor: THREE.Vector3; root: THREE.Group; bayTick: ((t: number, dt: number) => void) | null }
/** A portable cassette recorder: two-tone painted body, speaker, tuning scale, VU meter, piano keys, handle, aerial. */
export function deck(): Deck {
  const root = new THREE.Group();
  const W = 0.3, H = 0.165, D = 0.085;
  const sh = rrShape(W, H, 0.02);
  const TW = 300, TH = 165;
  const teal = rgb(0x2f7a78), tealD = rgb(0x1f5a5a), cream = rgb(0xefe2c4), chrome = rgb(0xb8bcc0);
  const t = new Tex(TW, TH);
  // the body: teal below, a cream panel band at the top
  wash(t, 0, 0, TW, TH, (x, y) => (y < 44 ? cream : teal), { seed: 41, ang: 0, angJ: 0.3, len: 7, val: 0.1, hue: 0.6, n: 9000 });
  for (let x = 0; x < TW; x++) { t.set(x, 44, tint(chrome, -0.1)); t.set(x, 45, chrome); t.set(x, 46, tint(chrome, -0.3)); }
  // the tuning scale window: numbers, a red needle
  const sx0 = 22, sx1 = 192, sy0 = 8, sy1 = 29;
  for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) t.set(x, y, tint(rgb(0x1a1c1a), (hash(x, y, 2) - 0.5) * 0.1));
  for (let x = sx0 + 6; x < sx1 - 6; x += 4) for (let y = sy1 - 8; y < sy1 - (x % 20 === 2 ? 2 : 5); y++) t.set(x, y, rgb(0xe8d8a0));
  letter(t, 'FM 88 96 104', (sx0 + sx1) / 2, sy0 + 12, F.small(16), rgb(0xe8d8a0), { spacing: 0 });
  for (let y = sy0 + 2; y < sy1 - 2; y++) t.set(118, y, rgb(0xe83a2a));
  letter(t, 'HOLLOW TONE', (sx0 + sx1) / 2, 42, F.small(16), rgb(0x6a4a2a), { spacing: 1 });
  // the VU meter (a real needle swings over it)
  for (let y = 12; y < 36; y++) for (let x = 206; x < 244; x++) t.set(x, y, mix3(rgb(0xf4e8b0), rgb(0xe8c870), (y - 12) / 24));
  for (let a = -0.9; a <= 0.9; a += 0.15) { const cx = 225, cy = 38; for (let r = 16; r < 19; r++) t.set(cx + Math.sin(a) * r, cy - Math.cos(a) * r, a > 0.45 ? rgb(0xc8281e) : rgb(0x2a2420)); }
  letter(t, 'VU', 225, 33, F.small(16), rgb(0x2a2420));
  // the cassette bay: a dark recess with a chrome edge
  const bx0 = 152, bx1 = 288, by0 = 54, by1 = 156;
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) { const e = Math.min(x - bx0, bx1 - 1 - x, y - by0, by1 - 1 - y); t.set(x, y, e < 2 ? chrome : tint(rgb(0x141414), (hash(x, y, 7) - 0.5) * 0.15 - (e < 6 ? 0.2 : 0))); }
  // the speaker surround on the left (the grille itself is a separate disc)
  const scx = 76, scy = 104, sr = 54;
  for (let y = scy - sr - 3; y < scy + sr + 3; y++) for (let x = scx - sr - 3; x < scx + sr + 3; x++) { const d = Math.hypot(x - scx, y - scy); if (d < sr + 3 && d > sr - 1) t.set(x, y, tint(tealD, -0.2)); }
  // labels under the keys, a little sticker
  // [font6] the keys' symbols (record, rewind, play, fast-forward, stop, eject), 7 texels tall, above each key
  const KEY_SYM = [
    ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
    ['...#..#', '..##.##', '.######', '#######', '.######', '..##.##', '...#..#'],
    ['.#.....', '.###...', '.#####.', '.######', '.#####.', '.###...', '.#.....'],
    ['#..#...', '##.##..', '######.', '#######', '######.', '##.##..', '#..#...'],
    ['.......', '######.', '######.', '######.', '######.', '######.', '.......'],
    ['...#...', '..###..', '.#####.', '#######', '.......', '#######', '#######'],
  ];
  KEY_SYM.forEach((rows, i) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') t.set(Math.round(bx0 + 11 + i * 22.6) - 3 + x, by0 - 10 + y, i === 0 ? rgb(0xe83a2a) : rgb(0xf0e6cc)); })));
  // worn paint along every edge (the cream and teal rubbed through to grey primer)
  wear(t, (x, y) => Math.max(0, 1 - Math.min(x, y, TW - 1 - x, TH - 1 - y) / 6), { seed: 3, chip: rgb(0x9a9890), k: 0.3 });
  strokes(t, 0, 0, TW, TH, (x, y) => t.get(x, y), { seed: 77, ang: 0, len: 3, val: 0.06, hue: 0.4, n: 3000 });
  const faceM = std({ map: tex(t), roughness: 0.45 });
  const sideT = new Tex(64, 16);
  wash(sideT, 0, 0, 64, 16, () => teal, { seed: 6, ang: 0, len: 6 });
  const sideM = std({ map: tex(sideT, { repeat: true }), roughness: 0.45 });
  // the bay is a real recess: a hole through the body with a dark painted back (tape head, spindles, guides)
  const bcx0 = ((bx0 + bx1) / 2 - TW / 2) / 1000, bcy0 = (TH / 2 - (by0 + by1) / 2) / 1000;
  sh.holes.push(new THREE.Path(rrShape((bx1 - bx0 - 4) / 1000, (by1 - by0 - 4) / 1000, 0.004, bcx0, bcy0).getPoints(6)));
  const body = mesh(slab(sh, D - 0.006, 0.003, { x0: -W / 2, y0: -H / 2, w: W, h: H }, 8, 10), [faceM, sideM]);
  const g = new THREE.Group();
  g.add(body);
  const front = D / 2;
  const rt = new Tex(68, 50);
  wash(rt, 0, 0, 68, 50, (x, y) => tint(rgb(0x1c1a18), -(Math.min(x, y, 67 - x, 49 - y) < 4 ? 0.3 : 0)), { seed: 12, ang: 0, len: 5, val: 0.2 });
  for (const sx of [24, 44]) { blob(rt, sx, 22, 3, rgb(0xd8d4c8)); rt.set(sx, 22, rgb(0x5a5650)); }
  for (let x = 30; x < 38; x++) for (let y = 40; y < 46; y++) rt.set(x, y, tint(rgb(0xc8ccd0), (hash(x, y, 2) - 0.5) * 0.3));
  for (const gx of [14, 54]) for (let y = 40; y < 46; y++) { rt.set(gx, y, rgb(0x9a9a9a)); rt.set(gx + 1, y, rgb(0x7a7a7a)); }
  const back = mesh(new THREE.PlaneGeometry((bx1 - bx0) / 1000, (by1 - by0) / 1000), std({ map: tex(rt), roughness: 0.8 }), false);
  back.position.set(bcx0, bcy0, front - 0.03);
  g.add(back);
  // speaker: a recessed paper cone behind a perforated chrome grille, a chrome ring
  const coneT = new Tex(32, 32);
  wash(coneT, 0, 0, 32, 32, () => rgb(0x2a2420), { seed: 3, ang: Math.PI / 2, len: 5 });
  const cone = mesh(turn([[0.05, 0], [0.03, -0.008], [0.012, -0.014], [0.012, -0.012], [0, -0.012]], 32).g, std({ map: tex(coneT), roughness: 0.9, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI / 2;
  const spk = new THREE.Group();
  spk.position.set((scx - TW / 2) / 1000, (TH / 2 - scy) / 1000, front - 0.001);
  spk.add(cone);
  const gt = new Tex(96, 96);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const d = Math.hypot(x - 47.5, y - 47.5);
    const hole = ((x % 4) - 1.5) ** 2 + (((y + (Math.floor(x / 4) % 2) * 2) % 4) - 1.5) ** 2 < 1.6;
    gt.set(x, y, tint(chrome, (hash(x, y, 3) - 0.5) * 0.15 + (vnoise(x * 0.1, y * 0.1, 4) - 0.5) * 0.15)); gt.alpha(x, y, d > 47.5 ? 0 : hole ? 0 : 1);
  }
  const grille = mesh(new THREE.CircleGeometry(0.052, 40), std({ map: tex(gt), metalness: 0.8, roughness: 0.35, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), false);
  grille.position.z = 0.003;
  const ring = mesh(new THREE.TorusGeometry(0.0535, 0.0028, 8, 48), std({ color: 0xd0d4d8, metalness: 0.95, roughness: 0.22 }));
  ring.position.z = 0.003;
  spk.add(grille, ring);
  g.add(spk);
  // the VU needle
  const needle = new THREE.Group();
  const nm = mesh(new THREE.PlaneGeometry(0.0008, 0.018), new THREE.MeshBasicMaterial({ color: 0x1a1210 }), false);
  nm.position.y = 0.009;
  needle.add(nm);
  needle.position.set((225 - TW / 2) / 1000, (TH / 2 - 38) / 1000, front + 0.0005);
  g.add(needle);
  // the volume knob: knurled, a white index line
  const kt = new Tex(64, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) kt.set(x, y, x % 4 < 2 ? rgb(0x2a2624) : rgb(0x4a4440));
  for (let y = 0; y < 16; y++) kt.set(32, y, rgb(0xf0f0e8));
  const knob = mesh(turn([[0, 0], [0.012, 0], [0.012, 0.012], [0.01, 0.014], [0, 0.0145]], 24).g, std({ map: tex(kt), roughness: 0.5 }));
  knob.rotation.x = Math.PI / 2; knob.position.set((268 - TW / 2) / 1000, (TH / 2 - 24) / 1000, front);
  g.add(knob);
  // the piano keys along the top edge, above the bay
  const keys: THREE.Object3D[] = [];
  const keyCol = [0xc8322a, 0xd8d2c4, 0x3a8a4a, 0xd8d2c4, 0xd8d2c4, 0xd8d2c4];
  // the key symbols, pixel by pixel: record, rewind, play, fast-forward, stop, eject
  const symT = new Tex(96, 16);
  for (let i = 0; i < 96 * 16; i++) symT.a[i] = 0;
  const px = (i: number, x: number, y: number) => { const c = i === 0 || i === 2 ? rgb(0xfff8ec) : rgb(0x2a2420); symT.set(i * 16 + x, y, c); symT.alpha(i * 16 + x, y, 1); };
  const tri = (i: number, x0: number, dir: 1 | -1, w: number) => { for (let k = 0; k < w; k++) for (let y = 8 - (w - k); y <= 8 + (w - k) - 1; y++) px(i, dir > 0 ? x0 + k : x0 - k, y); };
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if (Math.hypot(x - 7.5, y - 7.5) < 4) px(0, x, y);
  tri(1, 8, -1, 5); tri(1, 13, -1, 5);
  tri(2, 5, 1, 6);
  tri(3, 3, 1, 5); tri(3, 8, 1, 5);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) px(4, x, y);
  for (let k = 0; k < 5; k++) for (let x = 8 - k; x < 8 + k; x++) px(5, x, 4 + k);
  for (let x = 3; x < 13; x++) { px(5, x, 10); px(5, x, 11); }
  const symM = new THREE.MeshBasicMaterial({ map: tex(symT), transparent: true, alphaTest: 0.5 });
  for (let i = 0; i < 6; i++) {
    const k = new THREE.Group();
    const kb = mesh(new RoundedBoxGeometry(0.019, 0.012, 0.034, 2, 0.003), std({ color: keyCol[i], roughness: 0.4 }));
    kb.position.y = 0.006;
    const pg = new THREE.PlaneGeometry(0.014, 0.014);
    const uv = pg.attributes.uv as THREE.BufferAttribute;
    for (let j = 0; j < uv.count; j++) uv.setX(j, (i + uv.getX(j)) / 6);
    const sp = mesh(pg, symM, false);
    sp.rotation.x = -Math.PI / 2; sp.position.set(0, 0.0122, 0.006);
    k.add(kb, sp);
    k.position.set((bx0 + 11 + i * 22.6 - TW / 2) / 1000, H / 2 - 0.004, front - 0.026);
    g.add(k); keys.push(k);
  }
  // the carry handle and the aerial
  const hm = std({ color: 0xd6dadf, metalness: 0.95, roughness: 0.2 });
  g.add(mesh(tube([V(-0.11, H / 2 - 0.004, 0), V(-0.1, H / 2 + 0.03, 0), V(-0.04, H / 2 + 0.042, 0), V(0.04, H / 2 + 0.042, 0), V(0.1, H / 2 + 0.03, 0), V(0.11, H / 2 - 0.004, 0)], 0.0045, 1, 40, 10), hm));
  for (const sx of [-1, 1]) { const m = mesh(turn([[0.009, 0], [0.009, 0.004], [0.006, 0.008], [0, 0.009]], 16).g, std({ color: 0x2a2624, roughness: 0.5 })); m.position.set(sx * 0.11, H / 2 - 0.006, 0); g.add(m); }
  const aer = new THREE.Group();
  [0.0028, 0.0022, 0.0016].forEach((r, i) => { const m = mesh(new THREE.CylinderGeometry(r, r, 0.06, 10), hm); m.position.y = 0.03 + i * 0.058; aer.add(m); });
  const tip = mesh(turn([[0, 0], [0.003, 0.001], [0.0035, 0.004], [0.002, 0.007], [0, 0.0075]], 12).g, hm);
  tip.position.y = 0.176; aer.add(tip);
  aer.position.set(W / 2 - 0.02, H / 2 - 0.005, -D / 4); aer.rotation.z = -0.55;
  g.add(aer);
  // feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const f = mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.006, 12), std({ color: 0x1a1816, roughness: 0.9 })); f.position.set(sx * (W / 2 - 0.03), -H / 2 - 0.003, sz * (D / 2 - 0.018)); g.add(f); }
  // the bay holds the tape; the smoked door hinges down from its bottom edge
  const bay = new THREE.Group();
  const bcx = ((bx0 + bx1) / 2 - TW / 2) / 1000, bcy = (TH / 2 - (by0 + by1) / 2) / 1000;
  bay.position.set(bcx, bcy - 0.032, front - 0.016);
  g.add(bay);
  const door = new THREE.Group();
  const dw = (bx1 - bx0) / 1000, dh = (by1 - by0) / 1000;
  const dm = new THREE.MeshPhysicalMaterial({ color: 0x5a5048, roughness: 0.08, transparent: true, opacity: 0.32, envMapIntensity: 1.5, depthWrite: false });
  const pane = mesh(new RoundedBoxGeometry(dw - 0.006, dh - 0.006, 0.003, 2, 0.0012), dm, false);
  pane.position.y = dh / 2; pane.renderOrder = 4;
  const fr = rrShape(dw, dh, 0.006, 0, dh / 2);
  const fh = rrShape(dw - 0.01, dh - 0.01, 0.004, 0, dh / 2);
  fr.holes.push(new THREE.Path(fh.getPoints(8).reverse()));
  const frame = mesh(new THREE.ExtrudeGeometry(fr, { depth: 0.004, bevelEnabled: false, curveSegments: 6 }), std({ color: 0xc8ccd0, metalness: 0.9, roughness: 0.25 }));
  frame.position.z = -0.002;
  door.add(pane, frame);
  door.position.set(bcx, bcy - dh / 2, front + 0.002);
  g.add(door);
  g.position.y = H / 2 + 0.006;
  root.add(g);
  const anchor = new THREE.Vector3(bcx, bcy, front);
  const self: Deck = {
    obj: root, door, bay, keys, needle, cone, playing: false, doorOpen: 0, bayAnchor: anchor, root: g, bayTick: null,
    tick: (tt, dt) => {
      self.bayTick?.(tt, dt);
      door.rotation.x += (self.doorOpen * 0.95 - door.rotation.x) * Math.min(1, dt * 12);
      keys[2].position.y += ((self.playing ? H / 2 - 0.009 : H / 2 - 0.004) - keys[2].position.y) * Math.min(1, dt * 18);
      needle.rotation.z = self.playing ? -0.6 + Math.abs(Math.sin(tt * 7) * 0.5 + Math.sin(tt * 13.3) * 0.3) * 1.1 : -0.8;
      cone.scale.y = self.playing ? 1 + Math.max(0, Math.sin(tt * 18)) * 0.25 : 1;
    },
  };
  return self;
}

// ------------------------------------------------------------------ pillow

export const CASES: { base: RGB; alt: RGB; pat: 'stripe' | 'gingham' | 'floral' | 'ticking' | 'plain' }[] = [
  { base: rgb(0xf2e8d4), alt: rgb(0x3f5f8f), pat: 'ticking' },
  { base: rgb(0xb8cfa8), alt: rgb(0xe8eedc), pat: 'gingham' },
  { base: rgb(0xe8b8b4), alt: rgb(0xb84a5a), pat: 'floral' },
  { base: rgb(0x3a4f7a), alt: rgb(0xe8d6a8), pat: 'stripe' },
  { base: rgb(0xe8c46a), alt: rgb(0xb8862e), pat: 'plain' },
  { base: rgb(0xd8d0e8), alt: rgb(0x8a6aaa), pat: 'floral' },
  { base: rgb(0xf4ede0), alt: rgb(0xc85a3a), pat: 'stripe' },
  { base: rgb(0x8ab8b0), alt: rgb(0xf0ece0), pat: 'ticking' },
];
const pillowGeo = new Map<string, THREE.BufferGeometry>();
const pillowMat = new Map<number, THREE.MeshStandardMaterial>();
/** A plump pillow (w x d metres, t thick at the middle): puffed top and bottom, bowed edges, sharp piped seam. */
export function pillow(i = 0, w = 0.6, d = 0.4, th = 0.15): THREE.Mesh {
  const key = `${w}:${d}:${th}`;
  let geo = pillowGeo.get(key);
  if (!geo) {
    const N = 22, M = 16, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (let j = 0; j <= M; j++) for (let k = 0; k <= N; k++) {
        const u = (k / N) * 2 - 1, v = (j / M) * 2 - 1;
        const f = Math.pow(Math.max(0, (1 - Math.abs(u) ** 3.2) * (1 - Math.abs(v) ** 3.2)), 0.55);
        const x = u * (w / 2) * (1 - 0.08 * (1 - v * v)), z = v * (d / 2) * (1 - 0.1 * (1 - u * u));
        const y = side * (th / 2) * f * (side > 0 ? 1 : 0.8) + (side > 0 ? Math.sin(u * 5 + v * 3) * 0.004 * f : 0);
        pos.push(x, y + th * 0.4, z); uv.push(k / N, side > 0 ? 0.5 + (j / M) * 0.5 : (j / M) * 0.5);
      }
      for (let j = 0; j < M; j++) for (let k = 0; k < N; k++) {
        const a = base + j * (N + 1) + k, b = a + 1, c = a + N + 1, e = c + 1;
        if (side > 0) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);
      }
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    pillowGeo.set(key, geo);
  }
  const ci = i % CASES.length;
  let mat = pillowMat.get(ci);
  if (mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
  const c = CASES[ci];
  const T = new Tex(128, 128);
  const pat = (x: number, y: number): RGB => {
    const yy = y % 64;
    switch (c.pat) {
      case 'stripe': return (x % 16) < 5 ? c.alt : c.base;
      case 'ticking': return (x % 12) < 2 || (x % 12) === 4 ? c.alt : c.base;
      case 'gingham': { const a = (x % 12) < 6, b = (yy % 12) < 6; return a && b ? tint(c.base, -0.25) : a || b ? c.base : c.alt; }
      case 'floral': return c.base;
      default: return c.base;
    }
  };
  wash(T, 0, 0, 128, 128, pat, { seed: 10 + i, ang: Math.PI / 2, angJ: 0.4, len: 4, val: 0.1, hue: 0.6, n: 4500 });
  if (c.pat === 'floral') for (let k = 0; k < 26; k++) { const x = hash(k, 1, i) * 128, y = hash(k, 2, i) * 128; blob(T, x - 3, y + 1, 2.2, rgb(0x5a8a4a), 1, 1.2); blob(T, x, y, 2.6, (px, py) => mix3(c.alt, tint(c.alt, 0.4), vnoise(px, py, k))); T.set(x, y, tint(c.alt, -0.4)); }
  // the piped seam round the edge, soft creases from the corners
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const yy = y % 64, e = Math.min(x, 127 - x, yy, 63 - yy);
    if (e < 2) T.set(x, y, tint(c.alt, -0.15 + (hash(x, y, 2) - 0.5) * 0.2));
    else if (e < 5) T.shade(x, y, 0.9);
    const cx = Math.min(x, 127 - x) / 64, cy = Math.min(yy, 63 - yy) / 32;
    if (Math.abs(cx - cy) < 0.04 && cx < 0.4 && hash(x, y, 4) > 0.3) T.shade(x, y, 0.88);
  }
  mat = std({ map: tex(T), roughness: 0.95 });
  pillowMat.set(ci, mat);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ candle

/** A pillar candle on a brass chamberstick, a breathing flame and its warm light. */
export function candle(): Prop {
  const o = new THREE.Group();
  const brass = std({ color: 0xd8a848, metalness: 0.85, roughness: 0.3 });
  const bt = new Tex(64, 32);
  wash(bt, 0, 0, 64, 32, () => rgb(0xd8a848), { seed: 4, ang: 0, len: 6 });
  wear(bt, (x, y) => (y < 6 ? 1 : 0), { seed: 2, chip: rgb(0x6a5020), k: 0.2 });
  const dish = mesh(turn([[0, 0], [0.05, 0], [0.056, 0.004], [0.058, 0.012], [0.054, 0.013], [0.048, 0.006], [0.03, 0.006], [0.028, 0.012], [0.03, 0.016], [0, 0.016]], 48).g, std({ map: tex(bt), metalness: 0.85, roughness: 0.3 }));
  const ringH = mesh(new THREE.TorusGeometry(0.014, 0.0035, 8, 24), brass);
  ringH.position.set(0.064, 0.012, 0); ringH.rotation.y = Math.PI / 2; ringH.rotation.x = 0;
  const pts: [number, number][] = [[0, 0.016], [0.027, 0.016], [0.0272, 0.06], [0.0268, 0.104], [0.026, 0.109], [0.022, 0.106], [0.012, 0.103], [0, 0.102]];
  const { g, v } = turn(pts, 40);
  const wax = rgb(0xf2e2c0);
  const t = paintTurn(96, 96, v, (x, y, j) => (j >= 4 ? tint(wax, 0.04) : wax));
  // drips running down from the rim, lighter and glossier
  for (let i = 0; i < 9; i++) { const x0 = hash(i, 1, 3) * 96, len = 10 + hash(i, 2, 3) * 40; for (let y = Math.round((1 - v[3]) * 96); y < (1 - v[3]) * 96 + len; y++) for (let dx = -1; dx <= 1; dx++) t.set(x0 + dx + Math.sin(y * 0.3) * 0.6, y, tint(wax, 0.08 + (dx === 0 ? 0.04 : 0))); blob(t, x0, (1 - v[3]) * 96 + len, 2, tint(wax, 0.1)); }
  strokes(t, 0, 0, 96, 96, (x, y) => t.get(x, y), { seed: 6, ang: Math.PI / 2, len: 6, val: 0.06, hue: 0.4, wrap: true });
  const body = mesh(g, std({ map: tex(t), roughness: 0.55 }));
  // a melted, uneven rim
  const pp = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); if (y > 0.1) { const a = Math.atan2(pp.getZ(i), pp.getX(i)); pp.setY(i, y + Math.sin(a * 3) * 0.002 + Math.sin(a * 7 + 1) * 0.0012); } }
  g.computeVertexNormals();
  const wick = mesh(tube([V(0, 0.101, 0), V(0.0006, 0.107, 0), V(0.0016, 0.112, 0)], 0.0008, 1, 6, 5), std({ color: 0x1a1410, roughness: 1 }));
  // the flame: two crossed painted cards, flickering
  const ft = new Tex(16, 32);
  for (let i = 0; i < ft.a.length; i++) ft.a[i] = 0;
  for (let y = 0; y < 32; y++) { const q = y / 32, hw = Math.sin(Math.pow(1 - q, 0.7) * Math.PI) * 6.5 * (q > 0.8 ? (1 - q) * 5 : 1); for (let x = 0; x < 16; x++) { const d = Math.abs(x + 0.5 - 8) / Math.max(0.5, hw); if (d < 1) { ft.set(x, y, d < 0.35 && q > 0.35 ? rgb(0xfff8e0) : d < 0.7 ? rgb(0xffd070) : rgb(0xf08a30)); ft.alpha(x, y, q > 0.86 ? 0.6 : 1); if (q > 0.86 && d < 0.6) ft.set(x, y, rgb(0x5a8ad8)); } } }
  const fm = new THREE.MeshBasicMaterial({ map: smoothTex(pixelTex(new THREE.CanvasTexture(ft.canvas()), { mips: false })), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const flame = new THREE.Group();
  for (const r of [0, Math.PI / 2]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.03), fm); f.rotation.y = r; f.position.y = 0.012; flame.add(f); }
  flame.position.y = 0.106;
  const light = new THREE.PointLight(0xffb060, 0.25, 0.4, 2);
  light.position.y = 0.13;
  o.add(dish, ringH, body, wick, flame, light);
  return { obj: o, tick: (tt) => { const k = 1 + Math.sin(tt * 9) * 0.06 + Math.sin(tt * 23) * 0.04; flame.scale.set(1 / k, k, 1 / k); flame.rotation.z = Math.sin(tt * 3) * 0.06; light.intensity = 0.2 * k; } };
}

// ------------------------------------------------------------------ microphone

/** A broadcast microphone on a heavy round base; `cap` puts a knitted nightcap on it (switched off). */
export function microphone(cap = false): Prop {
  const o = new THREE.Group();
  const chromeT = new Tex(64, 96);
  wash(chromeT, 0, 0, 64, 96, (x, y) => mix3(rgb(0x8a9098), rgb(0xe8ecf0), vnoise(x * 0.08, y * 0.03, 3)), { seed: 5, ang: Math.PI / 2, len: 8, val: 0.2, hue: 0.3 });
  const chrome = std({ map: tex(chromeT), metalness: 0.92, roughness: 0.25 });
  const base = mesh(turn([[0, 0], [0.05, 0], [0.052, 0.006], [0.046, 0.016], [0.02, 0.022], [0.008, 0.026], [0, 0.026]], 40).g, chrome);
  const stem = mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.09, 12), chrome);
  stem.position.y = 0.065;
  // the capsule: a pill with a fine-ribbed grille, a chrome waist band
  const pts: [number, number][] = [[0, -0.05], [0.012, -0.049], [0.022, -0.043], [0.027, -0.03], [0.028, -0.006], [0.0292, -0.004], [0.0292, 0.004], [0.028, 0.006], [0.027, 0.03], [0.022, 0.043], [0.012, 0.049], [0, 0.05]];
  const cp = turn(pts, 40);
  const ct = paintTurn(96, 128, cp.v, (x, y, j) => (j === 4 || j === 5 || j === 6 ? rgb(0xe0e4e8) : (y % 3 === 0 ? rgb(0x3a3e44) : (x % 3 === 0 ? rgb(0x5a6068) : rgb(0x9aa0a8)))));
  strokes(ct, 0, 0, 96, 128, (x, y) => ct.get(x, y), { seed: 9, ang: 0, len: 3, val: 0.15, hue: 0.2, wrap: true, n: 1500 });
  const caps = mesh(cp.g, std({ map: tex(ct), metalness: 0.85, roughness: 0.35 }));
  const head = new THREE.Group();
  head.add(caps);
  // the yoke round it
  const yoke = mesh(new THREE.TorusGeometry(0.034, 0.003, 8, 32, Math.PI), chrome);
  yoke.rotation.z = Math.PI; yoke.position.y = 0;
  head.add(yoke);
  for (const sx of [-1, 1]) { const s = mesh(turn([[0, 0], [0.005, 0], [0.005, 0.006], [0, 0.007]], 12).g, chrome); s.rotation.z = -sx * Math.PI / 2; s.position.x = sx * 0.028; head.add(s); }
  head.position.y = 0.144; head.rotation.x = cap ? 0.35 : -0.12;
  // a red on-air lamp on the base
  const lamp = mesh(turn([[0, 0], [0.006, 0], [0.006, 0.003], [0.004, 0.005], [0, 0.0055]], 12).g, std({ color: cap ? 0x5a1a14 : 0xff3a2a, emissive: cap ? 0x000000 : 0xff2a1a, emissiveIntensity: 1.2, roughness: 0.3 }));
  lamp.position.set(0.026, 0.016, 0.022);
  o.add(base, stem, head, lamp);
  if (cap) {
    const kt = new Tex(64, 64);
    wash(kt, 0, 0, 64, 64, (x, y) => ((y >> 3) % 2 ? rgb(0x3a5a9a) : rgb(0xefe6d2)), { seed: 3, ang: Math.PI / 2, len: 3 });
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if ((x + (y % 2)) % 3 === 0) kt.shade(x, y, 0.85);
    const cg = turn([[0.032, -0.006], [0.0325, 0.006], [0.03, 0.012], [0.026, 0.03], [0.018, 0.05], [0.01, 0.066], [0.003, 0.078], [0, 0.08]], 32);
    const capM = mesh(cg.g, std({ map: tex(kt), roughness: 1 }));
    // the tip flops over
    const pp = cg.g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); if (y > 0.035) { const k = (y - 0.035) / 0.045; pp.setX(i, pp.getX(i) + k * k * 0.03); pp.setY(i, y - k * k * 0.012); } }
    cg.g.computeVertexNormals();
    const pom = new THREE.IcosahedronGeometry(0.009, 1);
    const pp2 = pom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp2.count; i++) { const k = 1 + (hash(i, 1, 4) - 0.5) * 0.35; pp2.setXYZ(i, pp2.getX(i) * k, pp2.getY(i) * k, pp2.getZ(i) * k); }
    pom.computeVertexNormals();
    const pm = mesh(pom, std({ color: 0xf4ecdc, roughness: 1, flatShading: true }));
    pm.position.set(0.031, 0.066, 0);
    const capG = new THREE.Group();
    capG.add(capM, pm);
    capG.position.y = 0.02;
    head.add(capG);
  }
  return { obj: o, tick: cap ? undefined : (tt) => { (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(tt * 4) * 0.5; } };
}

// ------------------------------------------------------------------ sun and moon ornaments

/** A brass desk ornament: 'sun', 'moon' or 'dial' (half sun, half moon), its face painted, on a turned stand. */
export function celestial(kind: 'sun' | 'moon' | 'dial'): Prop {
  const o = new THREE.Group();
  const bt = new Tex(64, 32);
  wash(bt, 0, 0, 64, 32, () => rgb(0xc89a3e), { seed: 6, ang: 0, len: 6, val: 0.15 });
  const brass = std({ map: tex(bt), metalness: 0.85, roughness: 0.32 });
  o.add(mesh(turn([[0, 0], [0.038, 0], [0.04, 0.006], [0.032, 0.012], [0.03, 0.016], [0.012, 0.02], [0.006, 0.03], [0.004, 0.08], [0.007, 0.084], [0, 0.085]], 32).g, brass));
  const R = 0.05, cy = 0.085 + R * (kind === 'moon' ? 0.9 : 1.15);
  const face = new THREE.Group();
  face.position.y = cy;
  o.add(face);
  const T = 128, t = new Tex(T, T);
  for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
  const gold = rgb(0xf0b83a), goldD = rgb(0xc8781e), blue = rgb(0x22346e), silver = rgb(0xd8dce8);
  const C0 = T / 2;
  const facePaint = (x: number, y: number, sun: boolean): RGB => {
    const d = Math.hypot(x - C0, y - C0) / (T / 2);
    if (sun) return mix3(rgb(0xffe08a), gold, d) as RGB;
    return mix3(rgb(0x3a58a8), rgb(0x16224e), d) as RGB; // [dialog10] a starry night, not a crescent
  };
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const sunSide = kind === 'sun' || (kind === 'dial' && x < C0);
    t.set(x, y, kind === 'dial' && !sunSide ? tint(blue, (hash(x, y, 3) - 0.5) * 0.2) : facePaint(x, y, sunSide)); t.alpha(x, y, 1);
  }
  if (kind !== 'sun') for (let i = 0; i < 18; i++) { const x = (kind === 'dial' ? C0 + 4 : 10) + hash(i, 1, 9) * (kind === 'dial' ? C0 - 12 : T - 20), y = 10 + hash(i, 2, 9) * (T - 20); t.set(x, y, rgb(0xfff0b0)); t.set(x + 1, y, rgb(0xfff0b0)); }
  const twinkle = (cx: number, cy2: number, r: number) => { for (let k = -r; k <= r; k++) { const c = rgb(Math.abs(k) < r * 0.4 ? 0xfff8d8 : 0xf0c860); t.set(cx + k, cy2, c); t.set(cx, cy2 + k, c); } t.set(cx + 1, cy2 + 1, rgb(0xfff0b0)); t.set(cx - 1, cy2 - 1, rgb(0xfff0b0)); };
  // [dialog10] no cartoon faces: a guilloche sunburst engraved in the gold, stars set in the night enamel
  if (kind !== 'moon') for (let y = 0; y < T; y++) for (let x = 0; x < (kind === 'dial' ? C0 : T); x++) {
    const a = Math.atan2(y - C0, x - C0), d = Math.hypot(x - C0, y - C0) / C0;
    if (d < 0.95) t.shade(x, y, 1 - 0.07 * (0.5 + 0.5 * Math.cos(a * 24)) * (0.4 + d * 0.6));
  }
  if (kind === 'moon') { twinkle(C0 + 30, C0 - 34, 6); twinkle(C0 - 36, C0 - 30, 4); twinkle(C0 + 6, C0 + 18, 9); twinkle(C0 - 22, C0 + 36, 3); }
  if (kind === 'dial') { twinkle(C0 + 28, C0 - 4, 8); twinkle(C0 + 18, C0 + 26, 4); }
  strokes(t, 0, 0, T, T, (x, y) => t.get(x, y), { seed: 12, ang: 0.8, len: 5, val: 0.12, hue: 0.6, n: 3000 });
  const faceM = std({ map: tex(t), metalness: 0.3, roughness: 0.4 });
  const sideM = std({ color: kind === 'moon' ? 0xb8bcc8 : 0xd8a040, metalness: 0.85, roughness: 0.3 });
  const shape = new THREE.Shape(); shape.absarc(0, 0, R * 0.72, 0, Math.PI * 2, false);
  const disc = mesh(slab(shape, 0.008, 0.002, { x0: -R, y0: -R, w: R * 2, h: R * 2 }, 30, 32), [faceM, sideM]);
  face.add(disc);
  // rays (the sun's half of the dial, all round for the sun)
  if (kind !== 'moon') {
    const rs = new THREE.Shape(), n = 14, pts: [number, number][] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? R * 0.74 : R * (1.08 + (i % 4 === 0 ? 0.12 : 0));
      if (kind === 'dial' && Math.cos(a) > 0.02) continue;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    if (kind === 'dial') { pts.unshift([0, R * 0.7]); pts.push([0, -R * 0.7]); }
    pts.forEach(([x, y], i) => (i ? rs.lineTo(x, y) : rs.moveTo(x, y)));
    rs.closePath();
    const ray = mesh(slab(rs, 0.004, 0.0015, { x0: -R, y0: -R, w: R * 2, h: R * 2 }, 30, 4), [std({ color: 0xf0b030, metalness: 0.8, roughness: 0.3 }), sideM]);
    ray.position.z = -0.002;
    face.add(ray);
  }
  if (kind === 'moon') {
    const star = new THREE.Shape();
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.006 : 0.014; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) star.moveTo(x, y); else star.lineTo(x, y); }
    for (const [x, y, s] of [[0.036, 0.034, 1], [0.046, -0.014, 0.7], [-0.04, 0.026, 0.55]]) { const m = mesh(slab(star, 0.004, 0.001, { x0: -0.014, y0: -0.014, w: 0.028, h: 0.028 }, 30, 2), [std({ color: 0xffe08a, metalness: 0.7, roughness: 0.3, emissive: 0x3a2a08 }), sideM]); m.position.set(x, y, 0); m.scale.setScalar(s); face.add(m); }
  }
  return { obj: o, tick: (tt) => { face.rotation.y = Math.sin(tt * 0.8) * 0.12; } };
}

// ------------------------------------------------------------------ [dialog10] clocks: a twin-bell alarm clock and a pocket watch

/** a clock dial painted smooth at high resolution: enamel, minute track, numerals in Alagard, a maker's name */
function dialTex(o: { face: string; ink: string; accent: string; numerals: 'arabic' | 'roman'; maker: string; sub?: boolean }): THREE.CanvasTexture {
  const N = 512, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!, C = N / 2;
  // enamel: a soft vignette and a faint warm sheen, as old enamel has
  const gr = g.createRadialGradient(C * 0.8, C * 0.7, N * 0.05, C, C, C);
  gr.addColorStop(0, o.face); gr.addColorStop(0.85, o.face); gr.addColorStop(1, 'rgba(120,96,60,1)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${hash(i, 1) > 0.5 ? '255,255,255' : '120,90,50'},${0.02 + hash(i, 2) * 0.03})`; g.fillRect(hash(i, 3) * N, hash(i, 4) * N, 2 + hash(i, 5) * 3, 1 + hash(i, 6) * 2); }
  g.translate(C, C);
  g.strokeStyle = g.fillStyle = o.ink; g.lineCap = 'round';
  // the minute track: a fine double ring and sixty ticks, heavier at the hours
  g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, C * 0.9, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, C * 0.8, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, hr = i % 5 === 0, r0 = hr ? C * 0.78 : C * 0.82;
    g.lineWidth = hr ? 7 : 2.4;
    g.beginPath(); g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(a) * C * 0.89, -Math.cos(a) * C * 0.89); g.stroke();
  }
  const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2, r = C * (o.numerals === 'roman' ? 0.62 : 0.64), t = o.numerals === 'roman' ? ROMAN[h] : String(h || 12);
    g.save(); g.translate(Math.sin(a) * r, -Math.cos(a) * r);
    if (o.numerals === 'roman') g.rotate(a);
    g.font = `${o.numerals === 'roman' ? 48 : 64}px ${STACK}`;
    g.fillStyle = o.ink; g.fillText(alagardSafe(t), 0, 2);
    g.restore();
  }
  g.font = `32px ${STACK}`; g.fillStyle = o.accent;
  g.fillText(alagardSafe(o.maker), 0, -C * 0.3);
  if (o.sub) {
    // the small seconds
    g.lineWidth = 1.6; g.strokeStyle = o.ink; g.beginPath(); g.arc(0, C * 0.36, C * 0.17, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.sin(a) * C * 0.13, C * 0.36 - Math.cos(a) * C * 0.13); g.lineTo(Math.sin(a) * C * 0.165, C * 0.36 - Math.cos(a) * C * 0.165); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/** a clock hand (spade tip, a round boss and a short tail), pointing up +y from its pivot, flat in z */
function hand(len: number, w: number, m: THREE.Material, tail = 0.22): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.5, -len * tail);
  s.lineTo(w * 0.5, -len * tail);
  s.lineTo(w * 0.4, len * 0.7);
  s.quadraticCurveTo(w * 1.4, len * 0.78, 0, len);
  s.quadraticCurveTo(-w * 1.4, len * 0.78, -w * 0.4, len * 0.7);
  s.closePath();
  const boss = new THREE.Shape(); boss.absarc(0, 0, w * 1.3, 0, Math.PI * 2, false);
  return new THREE.Mesh(new THREE.ExtrudeGeometry([s, boss], { depth: w * 0.25, bevelEnabled: false, curveSegments: 8 }), m);
}
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };

/** A twin-bell alarm clock in mint enamel and brass, its hands at `at()` (minutes), ringing now and then. */
export function alarmClock(at: () => number = nowMin): Prop {
  const o = new THREE.Group(), body = new THREE.Group();
  o.add(body);
  const R = 0.05, D = 0.034, cy = R + 0.012;
  const enamel = std({ color: 0x8fd0b6, roughness: 0.32, metalness: 0.05 });
  const brass = std({ color: 0xd9a64a, metalness: 0.9, roughness: 0.28 });
  const steel = std({ color: 0x2a2422, metalness: 0.6, roughness: 0.35 });
  const bellM = std({ color: 0xe2b458, metalness: 0.95, roughness: 0.2, side: THREE.DoubleSide });
  // the drum, its axis toward the viewer
  const drum = mesh(turn([[0, -D / 2], [R - 0.003, -D / 2], [R, -D / 2 + 0.003], [R + 0.0015, 0], [R, D / 2 - 0.003], [R - 0.003, D / 2], [0, D / 2]], 48).g, enamel);
  drum.rotation.x = Math.PI / 2;
  // the bezel and the dial under a domed glass
  const bezel = mesh(new THREE.TorusGeometry(R - 0.002, 0.0042, 12, 64), brass);
  bezel.position.z = D / 2;
  const face = mesh(new THREE.CircleGeometry(R - 0.004, 64), std({ map: dialTex({ face: '#fbf4e2', ink: '#241a16', accent: '#b0302c', numerals: 'arabic', maker: 'HOLLOW & CO.' }), roughness: 0.5 }));
  face.position.z = D / 2 + 0.0006;
  const glass = mesh(new THREE.SphereGeometry(R * 1.6, 48, 12, 0, Math.PI * 2, 0, 0.6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 1.2 }), false);
  glass.rotation.x = Math.PI / 2; glass.position.z = D / 2 - R * 1.6 * Math.cos(0.6) + 0.004;
  const hands = new THREE.Group();
  hands.position.z = D / 2 + 0.0008;
  const hr = hand(R * 0.5, 0.0042, steel), mn = hand(R * 0.74, 0.0034, steel), al = hand(R * 0.32, 0.0026, brass, 0.1);
  hr.position.z = 0.0006; mn.position.z = 0.0018; al.position.z = 0.0001;
  const cap = mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.004, 16), brass); cap.rotation.x = Math.PI / 2; cap.position.z = 0.003;
  hands.add(al, hr, mn, cap);
  body.add(drum, bezel, face, hands, glass);
  body.position.y = cy;
  // bells on curved posts, the hammer between them, the carrying handle, two ball feet, the winding key behind
  const bells: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0, cy, -0.004); arm.rotation.z = -s * 0.68;
    const post = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, R + 0.012, 8), brass); post.position.y = (R + 0.012) / 2;
    const bell = mesh(new THREE.SphereGeometry(0.024, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), bellM);
    bell.position.y = R + 0.012;
    const knob = mesh(new THREE.SphereGeometry(0.004, 12, 8), brass); knob.position.y = R + 0.012 + 0.024;
    arm.add(post, bell, knob);
    o.add(arm); bells.push(bell);
    const foot = mesh(new THREE.SphereGeometry(0.007, 16, 12), brass);
    foot.position.set(s * Math.sin(0.62) * (R + 0.002), cy - Math.cos(0.62) * (R + 0.002), 0);
    o.add(foot);
    const leg = mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.012, 8), brass);
    leg.position.set(s * Math.sin(0.62) * (R - 0.004), cy - Math.cos(0.62) * (R - 0.004), 0); leg.rotation.z = s * 0.62;
    o.add(leg);
  }
  const hammer = new THREE.Group();
  hammer.position.set(0, cy + R, -0.006);
  const rod = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.022, 8), steel); rod.position.y = 0.011;
  const ball = mesh(new THREE.SphereGeometry(0.0045, 12, 8), brass); ball.position.y = 0.022;
  hammer.add(rod, ball);
  const handleArc = mesh(new THREE.TorusGeometry(0.03, 0.0026, 10, 32, Math.PI), brass);
  handleArc.position.set(0, cy + R - 0.004, -0.014); handleArc.rotation.y = Math.PI / 2;
  const key = mesh(new RoundedBoxGeometry(0.022, 0.014, 0.003, 2, 0.002), brass); key.position.set(0, cy, -D / 2 - 0.008);
  o.add(hammer, handleArc, key);
  const place = () => {
    const m = ((at() % 720) + 720) % 720;
    hr.rotation.z = -(m / 720) * Math.PI * 2; mn.rotation.z = -((m % 60) / 60) * Math.PI * 2;
    al.rotation.z = -(((at() - 2) % 720) / 720) * Math.PI * 2;
  };
  place();
  return {
    obj: o,
    tick: (t) => {
      place();
      // it rings for a moment every few seconds: the hammer drums, the bells shiver, the clock hops on its feet
      const ring = t % 3.4 < 0.7;
      hammer.rotation.z = ring ? Math.sin(t * 70) * 0.55 : 0;
      body.position.x = ring ? Math.sin(t * 61) * 0.0012 : 0;
      o.rotation.z = ring ? Math.sin(t * 47) * 0.02 : 0;
      for (const b of bells) b.rotation.y = ring ? Math.sin(t * 90) * 0.1 : 0;
    },
  };
}

/** A gold pocket watch lying face up on its chain, keeping the real time. */
export function pocketWatch(): Prop {
  const o = new THREE.Group();
  const R = 0.045, T = 0.014;
  const gold = std({ color: 0xe3b25a, metalness: 0.95, roughness: 0.22 });
  const goldD = std({ color: 0xb8862e, metalness: 0.95, roughness: 0.3 });
  const blued = std({ color: 0x1c2a6a, metalness: 0.7, roughness: 0.25 });
  // the case (a rounded drum lying flat), its bezel and the dial
  const cas = mesh(turn([[0, 0], [R - 0.006, 0], [R - 0.001, 0.002], [R + 0.001, T * 0.45], [R - 0.001, T - 0.002], [R - 0.004, T], [0, T]], 64).g, gold);
  const bez = mesh(new THREE.TorusGeometry(R - 0.004, 0.0024, 12, 64), goldD); bez.rotation.x = -Math.PI / 2; bez.position.y = T;
  const dial = mesh(new THREE.CircleGeometry(R - 0.006, 64), std({ map: dialTex({ face: '#fbf6ea', ink: '#1b1712', accent: '#7a5a2a', numerals: 'roman', maker: 'HOLLOW', sub: true }), roughness: 0.4 }));
  dial.rotation.x = -Math.PI / 2; dial.position.y = T + 0.0004;
  const hands = new THREE.Group();
  hands.rotation.x = -Math.PI / 2; hands.position.y = T + 0.0008;
  const hr = hand(R * 0.42, 0.0034, blued), mn = hand(R * 0.66, 0.0026, blued);
  const sec = new THREE.Group(); sec.position.set(0, -(R - 0.006) * 0.36, 0);
  const sh = hand(R * 0.11, 0.0012, blued, 0.15); sec.add(sh);
  hr.position.z = 0.0004; mn.position.z = 0.0012; sh.position.z = 0.0004;
  hands.add(hr, mn, sec);
  // the crown and its bow, then the chain curling away across the paper
  const crown = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 16), goldD); crown.rotation.x = Math.PI / 2; crown.position.set(0, T / 2, -R - 0.004);
  const stem = mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 10), gold); stem.rotation.x = Math.PI / 2; stem.position.set(0, T / 2, -R);
  const bow = mesh(new THREE.TorusGeometry(0.009, 0.0018, 10, 28), gold); bow.rotation.x = -Math.PI / 2; bow.position.set(0, T / 2, -R - 0.015);
  o.add(cas, bez, dial, hands, crown, stem, bow);
  const curve = new THREE.CatmullRomCurve3([V(0, T / 2, -R - 0.022), V(0.02, 0.003, -R - 0.04), V(0.05, 0.003, -R - 0.03), V(0.066, 0.003, -0.01), V(0.058, 0.003, 0.03)]);
  // oval links, each turned a quarter to the last (one lies flat, the next stands), along the chain
  const n = 26, linkG = new THREE.TorusGeometry(0.0032, 0.00085, 8, 18);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    const holder = new THREE.Group();
    holder.position.copy(p);
    holder.rotation.y = Math.atan2(-tg.z, tg.x);
    const link = mesh(linkG, gold, false);
    link.scale.set(1.45, 1, 1);
    if (i % 2 === 0) link.rotation.x = Math.PI / 2;
    link.position.y = i % 2 === 0 ? 0 : 0.0012;
    holder.add(link);
    o.add(holder);
  }
  const place = () => {
    const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    hr.rotation.z = -(h / 12) * Math.PI * 2; mn.rotation.z = -(m / 60) * Math.PI * 2; sh.rotation.z = -(Math.floor(s * 5) / 5 / 60) * Math.PI * 2;
  };
  place();
  return { obj: o, tick: () => place() };
}

// ------------------------------------------------------------------ the phone

/** A generic smartphone (no brand): graphite body, a camera island, a screen showing `screen` (or dark). */
export function smartphone(screen: HTMLCanvasElement | null, glow = 0): Prop & { setScreen(c: HTMLCanvasElement | null): void } {
  const o = new THREE.Group();
  const W = 0.072, H = 0.152, D = 0.008;
  const bt = new Tex(64, 128);
  wash(bt, 0, 0, 64, 128, () => rgb(0x2a3040), { seed: 7, ang: Math.PI / 2, len: 8, val: 0.1, hue: 0.4 });
  wear(bt, (x, y) => Math.max(0, 1 - Math.min(x, y, 63 - x, 127 - y) / 3), { seed: 3, k: 0.4 });
  const back = std({ map: tex(bt), roughness: 0.35, metalness: 0.4 });
  const side = std({ color: 0x8a92a0, metalness: 0.9, roughness: 0.25 });
  const body = mesh(slab(rrShape(W, H, 0.009), D - 0.002, 0.001, { x0: -W / 2, y0: -H / 2, w: W, h: H }, 30, 10), [back, side]);
  const scrMat = new THREE.MeshBasicMaterial({ color: 0x0a0c12, toneMapped: false });
  const scrGeo = new THREE.ShapeGeometry(rrShape(W - 0.005, H - 0.005, 0.0075), 8);
  { const uv = scrGeo.attributes.uv as THREE.BufferAttribute, p = scrGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + (W - 0.005) / 2) / (W - 0.005), (p.getY(i) + (H - 0.005) / 2) / (H - 0.005)); }
  const scr = new THREE.Mesh(scrGeo, scrMat);
  scr.position.z = D / 2 + 0.0002;
  // the punch-hole camera
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), new THREE.MeshBasicMaterial({ color: 0x050608 }));
  cam.position.set(0, H / 2 - 0.008, D / 2 + 0.0004);
  // the camera island on the back
  const isl = mesh(new RoundedBoxGeometry(0.028, 0.03, 0.002, 2, 0.006), std({ color: 0x1e222c, roughness: 0.3, metalness: 0.5 }));
  isl.position.set(-W / 2 + 0.019, H / 2 - 0.021, -D / 2 - 0.0008);
  for (const [lx, ly] of [[-0.006, 0.006], [0.006, -0.006], [-0.006, -0.006]]) { const l = mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.002, 16), std({ color: 0x0a0c10, roughness: 0.1, metalness: 0.6 })); l.rotation.x = Math.PI / 2; l.position.set(isl.position.x + lx, isl.position.y + ly, -D / 2 - 0.0015); o.add(l); }
  const ph = new THREE.Group();
  ph.add(body, scr, cam, isl);
  // side buttons
  for (const [y, h] of [[0.03, 0.022], [0.0, 0.014]]) { const b = mesh(new RoundedBoxGeometry(0.0016, h, 0.003, 1, 0.0006), side); b.position.set(W / 2 + 0.0006, y, 0); ph.add(b); }
  o.add(ph);
  let light: THREE.PointLight | null = null;
  if (glow) { light = new THREE.PointLight(0x8ab8ff, glow, 0.35, 2); light.position.set(0, 0, 0.06); ph.add(light); }
  const setScreen = (c: HTMLCanvasElement | null) => {
    if (c) { const t = pixelTex(new THREE.CanvasTexture(c), { mips: false }); scrMat.map?.dispose(); scrMat.map = t; scrMat.color.setHex(0xffffff); }
    else { scrMat.map = null; scrMat.color.setHex(0x0a0c12); }
    scrMat.needsUpdate = true;
  };
  setScreen(screen);
  return { obj: o, setScreen, tick: light ? (tt) => { light!.intensity = glow * (0.8 + Math.sin(tt * 2.4) * 0.2); } : undefined };
}

/** The phone's own little bed: a wooden box, a folded quilt, a tiny pillow. */
export function phoneBed(phone: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  const wt = new Tex(64, 32);
  wash(wt, 0, 0, 64, 32, (x, y) => mix3(rgb(0x6a4024), rgb(0x8a5a34), vnoise(x * 0.05, y * 0.5, 3)), { seed: 5, ang: 0, len: 9, val: 0.12 });
  for (let x = 0; x < 64; x++) if (hash(x, 1, 3) > 0.6) wt.shade(x, (x * 7) % 32, 0.8);
  const wood = std({ map: tex(wt, { repeat: true }), roughness: 0.6 });
  const L = 0.2, Wd = 0.11, H = 0.03, th = 0.008;
  const part = (w: number, h: number, d: number, x: number, y: number, z: number) => { const m = mesh(new RoundedBoxGeometry(w, h, d, 2, 0.002), wood); m.position.set(x, y + h / 2, z); g.add(m); };
  part(Wd, th, L, 0, 0, 0);
  part(th, H, L, -Wd / 2 + th / 2, th, 0); part(th, H, L, Wd / 2 - th / 2, th, 0);
  part(Wd, H * 1.6, th, 0, th, -L / 2 + th / 2); part(Wd, H, th, 0, th, L / 2 - th / 2);
  const pl = pillow(1, 0.08, 0.04, 0.018);
  pl.position.set(0, th, -L / 2 + 0.03);
  g.add(pl);
  phone.rotation.set(-Math.PI / 2, 0, 0);
  phone.position.set(0, th + 0.009, 0.005);
  g.add(phone);
  const quilt = pillow(2, Wd - 0.012, 0.11, 0.02);
  quilt.position.set(0, th + 0.004, 0.04);
  g.add(quilt);
  return g;
}

/** A rustic stile for counting sheep: two posts, two rails. */
export function stile(): THREE.Group {
  const g = new THREE.Group();
  const wt = new Tex(32, 64);
  wash(wt, 0, 0, 32, 64, (x, y) => mix3(rgb(0x7a5230), rgb(0xa07848), vnoise(x * 0.3, y * 0.05, 2)), { seed: 9, ang: Math.PI / 2, len: 8, val: 0.15 });
  const wood = std({ map: tex(wt, { repeat: true }), roughness: 0.85 });
  for (const x of [-0.45, 0.45]) { const p = mesh(new RoundedBoxGeometry(0.08, 0.55, 0.08, 2, 0.015), wood); p.position.set(x, 0.275, 0); p.rotation.z = x * 0.04; g.add(p); }
  for (const y of [0.2, 0.42]) { const r = mesh(new RoundedBoxGeometry(1.05, 0.06, 0.04, 2, 0.012), wood); r.position.set(0, y, 0.05); r.rotation.z = (y - 0.3) * 0.08; g.add(r); }
  return g;
}

// ------------------------------------------------------------------ books

/** One clothbound hardback lying flat: boards with a little overhang, a rounded spine, a page block, gilt bands. */
function book(w: number, d: number, th: number, cloth: RGB, seed: number, title: string): THREE.Group {
  const g = new THREE.Group();
  const T = new Tex(64, 96);
  wash(T, 0, 0, 64, 96, () => cloth, { seed, ang: 0, angJ: 0.2, len: 4, val: 0.1, hue: 0.6, n: 2400 });
  for (let y = 0; y < 96; y++) for (let x = 0; x < 64; x++) if ((x + y) & 1) T.shade(x, y, 0.95);
  wear(T, (x, y) => Math.max(0, 1 - Math.min(x, y, 63 - x, 95 - y) / 4), { seed, k: 0.25 });
  const board = std({ map: tex(T), roughness: 0.75 });
  const bt = 0.004, ov = 0.004;
  for (const y of [0, th - bt]) { const b = mesh(new RoundedBoxGeometry(w + ov * 2, bt, d + ov, 1, 0.0015), board); b.position.set(ov / 2, y + bt / 2, 0); g.add(b); }
  // the page block: fine page edges
  const P = new Tex(32, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) P.set(x, y, tint(rgb(0xf0e4c8), (y % 2 ? -0.06 : 0.02) + (hash(x, y, seed) - 0.5) * 0.05));
  const pages = mesh(new THREE.BoxGeometry(w - 0.002, th - bt * 2, d - 0.004), std({ map: tex(P), roughness: 0.95 }));
  pages.position.set(0.001, th / 2, 0);
  g.add(pages);
  // the spine: a half round with gilt bands and a title
  const S = new Tex(32, 128);
  wash(S, 0, 0, 32, 128, () => cloth, { seed: seed + 1, ang: Math.PI / 2, len: 5 });
  for (const yy of [10, 14, 112, 116]) for (let x = 0; x < 32; x++) S.set(x, yy, rgb(0xe0b24a));
  { // [font6] the title runs along the spine, as on a real book (Alagard is too wide to fit across it)
    const lc = document.createElement('canvas'); lc.width = 128; lc.height = 32;
    const lg = lc.getContext('2d', { willReadFrequently: true })!;
    crispText(lg, title, 64, 21, F.small(16), '#000000', { align: 'center' });
    const ld = lg.getImageData(0, 0, 128, 32).data;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 128; x++) if (ld[(y * 128 + x) * 4 + 3] > 128) S.set(31 - y, x, rgb(0xf0cc6a));
  }
  const sp = new THREE.CylinderGeometry(th / 2, th / 2, d + ov, 16, 1, true, Math.PI, Math.PI);
  sp.rotateX(Math.PI / 2);
  const spine = mesh(sp, std({ map: tex(S), roughness: 0.7, side: THREE.DoubleSide }));
  spine.position.set(-w / 2, th / 2, 0);
  g.add(spine);
  return g;
}
/** A stack of three bedside books, a ribbon marker, a pair of reading glasses on top. */
export function bookStack(): Prop {
  const g = new THREE.Group();
  const specs: [number, number, number, number, string, number][] = [[0.17, 0.24, 0.032, 0x2f5a3a, 'TALES', 0.06], [0.15, 0.21, 0.026, 0x8a2a2a, 'POEMS', -0.12], [0.14, 0.2, 0.022, 0x2a3f7a, 'STARS', 0.2]];
  let y = 0;
  specs.forEach(([w, d, th, c, t, r], i) => { const b = book(w, d, th, rgb(c), 5 + i * 3, t); b.position.y = y; b.rotation.y = r; g.add(b); y += th; });
  const rib = mesh(tube([V(0.03, y - 0.02, 0.09), V(0.035, y - 0.03, 0.115), V(0.04, y - 0.055, 0.12)], 0.0025, 0.3, 10, 4), std({ color: 0xc8322a, roughness: 0.8 }));
  g.add(rib);
  // reading glasses: two wire rims and a bridge, folded arms
  const gold = std({ color: 0xd8a848, metalness: 0.9, roughness: 0.3 });
  const glasses = new THREE.Group();
  for (const sx of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.022, 0.0018, 6, 24), gold);
    rim.rotation.x = -Math.PI / 2 + 0.25; rim.position.set(sx * 0.026, 0.01, 0);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.021, 20), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }));
    lens.rotation.copy(rim.rotation); lens.position.copy(rim.position);
    const arm = mesh(tube([V(sx * 0.047, 0.012, -0.004), V(sx * 0.05, 0.008, -0.03), V(sx * 0.03, 0.006, -0.06)], 0.0014, 1, 10, 5), gold);
    glasses.add(rim, lens, arm);
  }
  glasses.add(mesh(tube([V(-0.005, 0.014, 0.002), V(0, 0.018, 0.003), V(0.005, 0.014, 0.002)], 0.0016, 1, 8, 5), gold));
  glasses.position.set(-0.01, y, 0.02); glasses.rotation.y = 0.5;
  g.add(glasses);
  return { obj: g };
}
