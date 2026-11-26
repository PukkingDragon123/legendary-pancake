// The big cuckoo clock's workshop: hand-painted pixel textures (walnut and oak grain, carved-leaf relief, enamel,
// shingles, emerald damask wallpaper, honey-oak wainscot, kraft and linen paper) painted in code with limited,
// hue-shifted ramps and an ordered dither, and the geometry the clock is carved from: lofted oak leaves with a
// raised midrib and curled tips, turned acorns, pine-cone weights built from spiralling scales, brass chain links,
// pierced Gothic clock hands, turned balusters and columns, scalloped bargeboards and fretwork, wooden shingles and
// a carved owl with spread wings. Pieces are merged per material and shaded with vertex colours (raised parts warm
// and light, recesses dark) so real light does the rest. OWNED BY THE CLOCK BUILDER (src/world/stages/cuckoo.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, hash, rng, vnoise } from '../../gfx/noise.ts';
import alagardUrl from '../../assets/fonts/alagard.ttf?url';

// ------------------------------------------------------------------ the Alagard pixel font (canvas text)

export const FONT = 'Alagard';
let fontP: Promise<void> | null = null;
/** Load Alagard for canvas painting (resolves even if it fails: canvas text then falls back). */
export function fontReady(): Promise<void> {
  if (!fontP) {
    fontP = (async () => {
      try {
        if (!document.fonts.check(`16px "${FONT}"`)) {
          const f = new FontFace(FONT, `url(${alagardUrl})`);
          document.fonts.add(await f.load());
        }
        await document.fonts.load(`16px "${FONT}"`, '0123456789hm');
      } catch { /* fallback font */ }
    })();
  }
  return fontP;
}

// ------------------------------------------------------------------ canvases and colour ramps

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
/** Crisp pixel texture: nearest magnification, mipmapped minification. */
export function ctex(c: HTMLCanvasElement, repeat = false, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];
/** a ramp colour at t (0..1), dithered between steps */
export function rampAt(r: RGB[], t: number, x: number, y: number, dither = 0.7): RGB {
  const f = Math.max(0, Math.min(r.length - 1, t * (r.length - 1) + bayer(x, y) * dither));
  return r[Math.round(f)];
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Tileable two-octave value noise (period W x H px) at a scale of (sx, sy) per px. */
function tnoise(x: number, y: number, W: number, H: number, sx: number, sy: number, s: number) {
  const n = (a: number, b: number) => fbm(a * sx, b * sy, 0.5, s);
  return (n(x, y) * (W - x) * (H - y) + n(x - W, y) * x * (H - y) + n(x, y - H) * (W - x) * y + n(x - W, y - H) * x * y) / (W * H);
}

function paint(w: number, h: number, f: (x: number, y: number) => RGB | [number, number, number, number]): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = f(x, y), i = (y * w + x) * 4;
    im.data[i] = p[0]; im.data[i + 1] = p[1]; im.data[i + 2] = p[2]; im.data[i + 3] = p.length > 3 ? (p as number[])[3] : 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// ------------------------------------------------------------------ wood

export interface Finish { id: string; name: string; ramp: RGB[] }
const R = (...h: string[]) => h.map(hex);
export const FINISHES: Finish[] = [
  { id: 'walnut', name: 'Black Forest walnut', ramp: R('#2a140c', '#3c1f12', '#522c18', '#6a3b1f', '#834c28', '#9c6033', '#b57641', '#cb8f52', '#dcaa6c') },
  { id: 'oak', name: 'Honey oak', ramp: R('#4a2810', '#643716', '#80491e', '#9c5d28', '#b67233', '#cb8a42', '#dca457', '#e9bd72', '#f2d394') },
  { id: 'cherry', name: 'Cherry', ramp: R('#36100a', '#4f1a10', '#6a2616', '#84341d', '#9c4425', '#b2562e', '#c56d3c', '#d6874e', '#e3a468') },
  { id: 'linden', name: 'Linden', ramp: R('#5a3c1e', '#7a5530', '#987044', '#b48a58', '#caa36e', '#dbba86', '#e8cfa0', '#f2e0b8', '#f8ecd0') },
];
export const finishOf = (id: string) => FINISHES.find((f) => f.id === id) ?? FINISHES[0];

/** Straight-grained wood, tileable, grain running along v. `bright` shifts the ramp (carvings are a touch lighter). */
export function woodCanvas(ramp: RGB[], W = 128, H = 256, seed = 3, bright = 0, figure = 1): HTMLCanvasElement {
  return paint(W, H, (x, y) => {
    const warp = tnoise(x, y, W, H, 0.05, 0.012, seed) - 0.5;
    const gx = x + warp * 26 * figure + Math.sin((y / H) * Math.PI * 2 * 2 + seed) * 3;
    const ring = ((gx / (W / 17)) % 1 + 1) % 1;
    const line = smooth(0.82, 1, ring) + smooth(0.12, 0, ring) * 0.6;
    const broad = tnoise(x, y, W, H, 0.03, 0.006, seed + 9);
    const fine = hash(x, Math.floor(y / 3), seed, 2);
    const pore = hash(x, Math.floor(y / 5), seed, 7) > 0.965 ? 1 : 0;
    const t = 0.5 + bright + (broad - 0.5) * 0.55 - line * 0.2 + (fine - 0.5) * 0.08 - pore * 0.16;
    return rampAt(ramp, clamp01(t), x, y);
  });
}

/** A carved oak leaf, painted in its own (u, v) space: grain, a grooved midrib, side veins, a darker rim. */
export function leafCanvas(ramp: RGB[], seed = 5): HTMLCanvasElement {
  const W = 128, H = 64;
  return paint(W, H, (x, y) => {
    const u = x / W, v = (y + 0.5) / H - 0.5;
    const grain = vnoise(x * 0.06, y * 0.5, 0, seed) - 0.5;
    let t = 0.58 + grain * 0.18 + (hash(x, y, seed) - 0.5) * 0.06;
    // the midrib: a groove with a lit ridge beside it
    const av = Math.abs(v);
    if (av < 0.035 && u < 0.94) t -= 0.42; else if (av < 0.07 && u < 0.92) t += 0.14;
    // side veins: angled grooves from the midrib toward the lobes, each with a lit ridge
    const ph = (((u * 7 - av * 5.5) % 1) + 1) % 1;
    if (av > 0.06 && av < 0.42 && u > 0.06 && u < 0.9) { if (ph < 0.13) t -= 0.36; else if (ph < 0.22) t += 0.1; }
    // the rim falls away into shadow
    t -= smooth(0.3, 0.5, av) * 0.28;
    return rampAt(ramp, clamp01(t), x, y);
  });
}

/** Carved plumage: overlapping scalloped feather rows with dark grooves (planar-mapped onto the carved owl). */
export function featherCanvas(ramp: RGB[], seed = 7): HTMLCanvasElement {
  const W = 128, H = 128;
  return paint(W, H, (x, y) => {
    const row = Math.floor(y / 9), off = (row % 2) * 6;
    const cx = ((x + off) % 12) - 6, cy = (y % 9);
    const d = Math.hypot(cx, cy * 1.25);
    let t = 0.6 - (cy / 9) * 0.25 + (hash(x, y, seed) - 0.5) * 0.06;
    if (d > 5.4 && d < 6.8 && cy > 2) t -= 0.35; // the groove round each feather
    if (Math.abs(cx) < 0.6 && cy > 2) t -= 0.12; // the shaft
    t += (vnoise(x * 0.08, y * 0.08, 0, seed) - 0.5) * 0.15;
    return rampAt(ramp, clamp01(t), x, y);
  });
}

/** Weathered wooden shingles: four variants side by side (one shingle each): grain, a darker overlap at the top,
 * a worn lit lower edge. */
export function shingleCanvas(seed = 11): HTMLCanvasElement {
  const ramp = R('#2a120c', '#3a1a10', '#4c2416', '#5f2f1b', '#733b21', '#894a28', '#a05c32', '#b8703d');
  const W = 32, H = 48;
  return paint(W * 4, H, (x, y) => {
    const v = Math.floor(x / W), lx = x % W;
    const g = vnoise(lx * 0.4 + v * 13, y * 0.05, v, seed) - 0.5;
    let t = 0.52 + g * 0.35 + (hash(x, y, seed) - 0.5) * 0.08 + (v - 1.5) * 0.04;
    t -= smooth(18, 0, y) * 0.38;
    if (y > H - 4) t += 0.12;
    if (lx < 1 || lx > W - 2) t -= 0.22;
    if (hash(v, Math.floor(y / 6), seed, 3) > 0.8 && Math.abs(lx - 8 - v * 4) < 1) t -= 0.15; // a split
    return rampAt(ramp, clamp01(t), x, y);
  });
}

// ------------------------------------------------------------------ the wall

/** Emerald regency-stripe wallpaper: a deep silk stripe sprigged with little gilt oak sprigs, a paler woven stripe,
 * fine gold pinstripes between them (lit from the top left: a bright edge and a dark one on each pinstripe). */
export function wallpaperCanvas(): HTMLCanvasElement {
  const W = 64, H = 64;
  const deep = R('#0b2c20', '#0e3426', '#113b2b', '#144231', '#184a37');
  const pale = R('#174a36', '#1b533c', '#1f5b42', '#246448', '#2a6d4f');
  const gold = R('#4e3f1c', '#6a5526', '#866c32', '#a2843f', '#bc9c52');
  // a gilt sprig: a stem, two oak leaves and an acorn (12 x 16), "#" gold, "+" light gold, "-" shade
  const SPRIG = [
    '.....++.....', '....+##-....', '....-##-....', '.....--.....', '.....#......', '.++..#..++..', '+##+.#.+##+.', '-###+#+###-.',
    '.-###+###-..', '..-##+##-...', '....-#-.....', '.....#......', '....+#......', '.....#......', '......-.....', '............',
  ];
  return paint(W, H, (x, y) => {
    const silk = ((x + y * 2) % 5 < 2 ? 0.05 : -0.02) + (hash(x, y, 31) - 0.5) * 0.06;
    if (x === 38 || x === 63) return rampAt(gold, clamp01(0.7 + silk), x, y);
    if (x === 39 || x === 0) return rampAt(gold, clamp01(0.25 + silk), x, y);
    if (x > 39 && x < 63) {
      const weave = (y % 3 === 0 ? -0.08 : 0.04) + (x % 4 === 0 ? -0.05 : 0);
      return rampAt(pale, clamp01(0.55 + weave + silk), x, y);
    }
    // the deep stripe with sprigs (one in the middle of each tile, half-dropped every other stripe is not needed)
    const sx = x - 13, sy = y - 24;
    if (sx >= 0 && sx < 12 && sy >= 0 && sy < 16) {
      const ch = SPRIG[sy][sx];
      if (ch === '#') return rampAt(gold, clamp01(0.55 + silk), x, y);
      if (ch === '+') return rampAt(gold, clamp01(0.85 + silk), x, y);
      if (ch === '-') return rampAt(deep, clamp01(0.1), x, y);
    }
    const edge = x === 1 ? -0.2 : x === 37 ? -0.12 : 0;
    return rampAt(deep, clamp01(0.55 + silk + edge), x, y);
  });
}

/** Honey-oak wainscot panelling: raised fielded panels between stiles, varnished. */
export function wainscotCanvas(): HTMLCanvasElement {
  const ramp = R('#2c160c', '#3c2012', '#4e2b18', '#62381f', '#764627', '#8a5530', '#9e653a', '#b27745', '#c48a52');
  const W = 128, H = 128;
  const grainV = woodCanvas(ramp, W, H, 21, 0.02).getContext('2d')!.getImageData(0, 0, W, H).data;
  return paint(W, H, (x, y) => {
    // stiles: 12 px at each side; panel 104 px wide with a 6 px bevel
    const px = x - 12, py = y - 12;
    const inP = px >= 0 && px < 104 && py >= 0 && py < 104;
    let k = 0;
    if (!inP) k = 0.02;
    else {
      const e = Math.min(px, py, 103 - px, 103 - py);
      if (e < 2) k = -0.22; // the groove round the panel
      else if (e < 8) k = (px < 8 && px <= py) || (py < 8 && py < px) ? 0.12 : -0.12; // bevel lit top left
      else k = 0.04;
    }
    const i = (y * W + x) * 4;
    const f = 1 + k;
    return [Math.min(255, grainV[i] * f), Math.min(255, grainV[i + 1] * f), Math.min(255, grainV[i + 2] * f)];
  });
}

// ------------------------------------------------------------------ the dial

/** Draw crisp pixel text: render with the pixel font, threshold the alpha, draw in `col` (with an optional shadow). */
export function pxText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, col: string, o: { align?: CanvasTextAlign; shadow?: string; maxW?: number; base?: CanvasTextBaseline; spacing?: number } = {}) {
  const W = Math.ceil(size * (text.length + 2) * 0.9) + 8, H = Math.ceil(size * 1.6) + 4;
  const [c2, g2] = canvas(W, H);
  let s = size;
  g2.font = `${s}px "${FONT}", serif`;
  if (o.maxW) while (s > 8 && g2.measureText(text).width > o.maxW) { s -= 1; g2.font = `${s}px "${FONT}", serif`; }
  g2.textBaseline = 'middle';
  g2.textAlign = 'left';
  const tw = Math.ceil(g2.measureText(text).width);
  g2.fillStyle = '#000';
  g2.fillText(text, 4, Math.round(H / 2));
  const d = g2.getImageData(0, 0, W, H);
  const [cr, cg, cb] = hex(col);
  for (let i = 0; i < d.data.length; i += 4) { const on = d.data[i + 3] > 110; d.data[i] = cr; d.data[i + 1] = cg; d.data[i + 2] = cb; d.data[i + 3] = on ? 255 : 0; }
  g2.putImageData(d, 0, 0);
  const al = o.align ?? 'center';
  const dx = Math.round(al === 'center' ? x - tw / 2 - 4 : al === 'right' ? x - tw - 4 : x - 4);
  const dy = Math.round((o.base === 'top' ? y + H / 2 - s * 0.35 : y) - H / 2);
  if (o.shadow) {
    const [c3, g3] = canvas(W, H);
    g3.drawImage(c2, 0, 0);
    g3.globalCompositeOperation = 'source-in';
    g3.fillStyle = o.shadow;
    g3.fillRect(0, 0, W, H);
    g.drawImage(c3, dx + 1, dy + 1);
  }
  g.drawImage(c2, dx, dy);
  return tw;
}

// ------------------------------------------------------------------ geometry helpers

export type Part = { geo: THREE.BufferGeometry; m?: THREE.Matrix4 };
export const mtx = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** Make a geometry mergeable: non-indexed, position/normal/uv/color, no groups. */
export function prep(g: THREE.BufferGeometry, col: RGB | null = null): THREE.BufferGeometry {
  let o = g.index ? g.toNonIndexed() : g;
  if (o !== g) g.dispose();
  o.clearGroups();
  for (const k of Object.keys(o.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) o.deleteAttribute(k);
  if (!o.attributes.normal) o.computeVertexNormals();
  if (!o.attributes.uv) o.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(o.attributes.position.count * 2), 2));
  if (!o.attributes.color) {
    const n = o.attributes.position.count, a = new Float32Array(n * 3);
    const c = col ? col.map((v) => v / 255) : [1, 1, 1];
    for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
    o.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
  }
  return o;
}
/** Merge parts (each transformed by its matrix) into one geometry. */
export function merge(parts: Part[]): THREE.BufferGeometry {
  const gs = parts.map((p) => { const g = prep(p.geo); if (p.m) g.applyMatrix4(p.m); return g; });
  const out = mergeGeometries(gs, false)!;
  for (const g of gs) g.dispose();
  return out;
}
export function scaleUV(g: THREE.BufferGeometry, ku: number, kv = ku, ou = 0, ov = 0): THREE.BufferGeometry {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ku + ou, uv.getY(i) * kv + ov);
  return g;
}
/**
 * Carving shade: vertex colours from the (already placed) normals and an optional depth. Faces toward the viewer are
 * warm and light, sides fall into shadow, faces toward the wall go dark: real carving reads through the cavities.
 */
export function carveShade(g: THREE.BufferGeometry, o: { lo?: number; hi?: number; tint?: RGB; z0?: number; z1?: number } = {}): THREE.BufferGeometry {
  const lo = o.lo ?? 0.42, hi = o.hi ?? 1;
  const tint = (o.tint ?? [255, 236, 214]).map((v) => v / 255);
  const n = g.attributes.normal as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const nz = n.getZ(i), ny = n.getY(i);
    let k = lo + (hi - lo) * smooth(-0.35, 0.85, nz * 0.85 + ny * 0.25);
    if (o.z0 !== undefined && o.z1 !== undefined) k *= 0.72 + 0.28 * smooth(o.z0, o.z1, p.getZ(i));
    col[i * 3] = k * (k < 0.8 ? 1 : tint[0]); col[i * 3 + 1] = k * (k < 0.8 ? 0.92 : tint[1]); col[i * 3 + 2] = k * (k < 0.8 ? 0.86 : tint[2]);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** An extruded shape spanning z = 0..t with an optional bevel that keeps the outline at the shape's size. */
export function extrude(shape: THREE.Shape | THREE.Shape[], t: number, bevel = 0, segs = 1, curve = 8): THREE.BufferGeometry {
  const b = Math.min(bevel, t * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, t - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: segs, curveSegments: curve });
  g.translate(0, 0, b);
  return g;
}
/** A "pillow" relief: a big rounded bevel on a silhouette (carved bodies, heads, cushioned panels). */
export function pillow(shape: THREE.Shape, t: number, round: number, segs = 4, curve = 10): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, t * 0.25), bevelEnabled: true, bevelThickness: t * 0.375, bevelSize: round, bevelOffset: -round, bevelSegments: segs, curveSegments: curve });
  g.translate(0, 0, t * 0.375);
  return g;
}
export function rect(w: number, h: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(cx - w / 2, cy - h / 2); s.lineTo(cx + w / 2, cy - h / 2); s.lineTo(cx + w / 2, cy + h / 2); s.lineTo(cx - w / 2, cy + h / 2); s.closePath();
  return s;
}
export function rectPath(w: number, h: number, cx = 0, cy = 0): THREE.Path {
  const s = new THREE.Path();
  s.moveTo(cx - w / 2, cy - h / 2); s.lineTo(cx - w / 2, cy + h / 2); s.lineTo(cx + w / 2, cy + h / 2); s.lineTo(cx + w / 2, cy - h / 2); s.closePath();
  return s;
}
export function circlePath(r: number, cx = 0, cy = 0, n = 14, cw = true): THREE.Path {
  const p = new THREE.Path();
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 * (cw ? -1 : 1); if (i === 0) p.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  return p;
}
/** A board with bevelled edges (w x h, thickness t), planar uvs in metres times k, grain along y. */
export function slab(w: number, h: number, t: number, bevel = 0.004, k = 4): THREE.BufferGeometry {
  const g = extrude(rect(w, h), t, bevel, 1);
  return scaleUV(g, k, k * 0.5, 0.31 * w, 0.17 * h);
}
/** An arched opening shape (rectangle with a round top). */
export function arch(w: number, h: number, cx = 0, y0 = 0): THREE.Shape {
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(cx - r, y0); s.lineTo(cx + r, y0); s.lineTo(cx + r, y0 + h - r);
  s.absarc(cx, y0 + h - r, r, 0, Math.PI, false);
  s.lineTo(cx - r, y0);
  return s;
}
export function archPath(w: number, h: number, cx = 0, y0 = 0): THREE.Path {
  const s = new THREE.Path(), r = w / 2;
  s.moveTo(cx - r, y0); s.lineTo(cx - r, y0 + h - r);
  s.absarc(cx, y0 + h - r, r, Math.PI, 0, true);
  s.lineTo(cx + r, y0); s.lineTo(cx - r, y0);
  return s;
}
/** A turned (lathed) piece from a radius profile [[r, y]...], uvs scaled to metres. */
export function turned(profile: [number, number][], segs = 12, k = 4): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), segs);
  const maxR = Math.max(...profile.map((p) => p[0])), len = Math.abs(profile[profile.length - 1][1] - profile[0][1]);
  return scaleUV(g, Math.PI * 2 * maxR * k, len * k * 0.5);
}

// ------------------------------------------------------------------ carved oak leaves and acorns

/**
 * A carved oak leaf, lofted (not extruded) so it can dome, curl and fold: u runs base to tip (length `len`), the
 * half-width follows a lobed outline; the top surface domes over a sunken midrib; the tip and base curl back toward
 * the surface it's carved from. Lies in the xy plane pointing +x, rising +z from z = 0. uvs: (u, v) in leafCanvas.
 */
export function leafGeo(len: number, wid: number, o: { lobes?: number; curl?: number; fold?: number; t?: number; seed?: number; twist?: number } = {}): THREE.BufferGeometry {
  const NU = 36, NV = 10, lobes = o.lobes ?? 3.5, curl = o.curl ?? 0.25, fold = o.fold ?? 0.12, th = o.t ?? 0.18, seed = o.seed ?? 1, tw = o.twist ?? 0;
  const half = (u: number) => {
    if (u <= 0 || u >= 1) return 0;
    const env = Math.pow(Math.sin(u * Math.PI), 0.75) * (0.85 + 0.25 * u);
    const lobe = 0.5 + 0.5 * Math.pow(Math.abs(Math.sin(u * Math.PI * lobes + 0.4 + hash(seed, 1, 2) * 0.6)), 0.55);
    return env * lobe * 0.5;
  };
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const P = (u: number, s: number, top: boolean) => {
    // s: -1..1 across the leaf
    const h = Math.max(0.004, half(u));
    const x = u * len, y = s * h * wid;
    const dome = top ? th * wid * (0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - s * s))) * (0.4 + 0.6 * Math.sin(Math.max(0.05, u) * Math.PI)) : 0;
    const rib = top && Math.abs(s) < 0.12 ? -th * wid * 0.25 : 0;
    const lobeW = Math.sin(u * Math.PI * lobes * 2 + 0.4 + hash(seed, 1, 2) * 1.2) * Math.abs(s) * th * wid * 0.55;
    const c = -curl * len * (Math.pow(u - 0.45, 2) * 1.6) - fold * wid * Math.abs(s) * 0.5 + tw * s * u * wid + (top ? lobeW : lobeW * 0.6);
    return [x, y, Math.max(0, dome + rib + c + curl * len * 0.32) ];
  };
  // top and bottom sheets
  for (const top of [true, false]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, s = (j / NV) * 2 - 1;
      pos.push(...P(u, s, top));
      uv.push(u, (s * half(u) + 0.5));
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = base + i * (NV + 1) + j, b = a + NV + 1;
      if (top) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // the cut edge round the outline
  const topBase = 0, botBase = (NU + 1) * (NV + 1);
  for (const j of [0, NV]) {
    for (let i = 0; i < NU; i++) {
      const t0 = topBase + i * (NV + 1) + j, t1 = t0 + NV + 1, b0 = botBase + i * (NV + 1) + j, b1 = b0 + NV + 1;
      if (j === 0) idx.push(t0, b0, t1, t1, b0, b1); else idx.push(t0, t1, b0, t1, b1, b0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** An acorn: a glossy nut with a point and a scaly cup with a stalk (two geometries: nut, cup). Points +y. */
export function acornGeo(s = 1): { nut: THREE.BufferGeometry; cup: THREE.BufferGeometry } {
  const nut = turned([[0, -0.026 * s], [0.004 * s, -0.024 * s], [0.011 * s, -0.018 * s], [0.0155 * s, -0.008 * s], [0.0168 * s, 0.002 * s], [0.016 * s, 0.01 * s]], 12, 30);
  const cup = turned([[0.0, 0.006 * s], [0.0172 * s, 0.004 * s], [0.0186 * s, 0.009 * s], [0.0178 * s, 0.015 * s], [0.0135 * s, 0.0195 * s], [0.006 * s, 0.022 * s], [0.0028 * s, 0.024 * s], [0.0024 * s, 0.031 * s], [0.001 * s, 0.033 * s]], 12, 30);
  // the cup's scales: a knobbly ripple on its surface
  const p = cup.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < 0.004 * s) continue;
    const a = Math.atan2(z, x), k = 1 + 0.08 * Math.max(0, Math.sin(a * 9 + y * 900 / s)) * Math.sin(y * 1400 / s);
    p.setXYZ(i, x * k, y, z * k);
  }
  cup.computeVertexNormals();
  return { nut, cup };
}

// ------------------------------------------------------------------ the pine-cone weight

/** A cast pine-cone weight hanging tip down: spiralling scales round a core, a cap and a hanging loop. Origin at
 * the loop, the cone hangs along -y (length `L`). Vertex colours: worn bronze on the scale tips, black iron deep. */
export function pineConeGeo(L = 0.22, Rm = 0.052): THREE.BufferGeometry {
  const parts: Part[] = [];
  const prof = (t: number) => Rm * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)), 0.8) * (1 - t * 0.25); // t 0 top .. 1 tip
  const core: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; core.push([prof(t) * 0.62, -0.03 - t * L]); }
  core.unshift([0.001, -0.03]);
  core.push([0.001, -0.035 - L]);
  parts.push({ geo: turned(core.reverse(), 12, 8) });
  // scales: a rounded shield, cupped
  const sh = new THREE.Shape();
  sh.moveTo(-0.5, 0); sh.quadraticCurveTo(-0.62, 0.62, 0, 1); sh.quadraticCurveTo(0.62, 0.62, 0.5, 0); sh.quadraticCurveTo(0, -0.12, -0.5, 0);
  const scale = extrude(sh, 0.16, 0.05, 1, 5);
  const N = 86, GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const t = 0.04 + (i / N) * 0.93;
    const a = i * GA;
    const r = prof(t);
    const y = -0.03 - t * L;
    const size = Rm * (0.62 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.05))) * 0.72;
    // stand the scale on the core surface, pointing outward and down (the cone hangs tip down)
    const m = new THREE.Matrix4()
      .makeTranslation(Math.cos(a) * r * 0.62, y, Math.sin(a) * r * 0.62)
      .multiply(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI * 0.5 + 0.55 + t * 0.25))
      .multiply(new THREE.Matrix4().makeScale(size, size * 1.15, size));
    const g = scale.clone();
    const c = g.attributes.position as THREE.BufferAttribute;
    // colour: deep near the root, bronze toward the lip
    const col = new Float32Array(c.count * 3);
    for (let k = 0; k < c.count; k++) { const lip = smooth(0.35, 1, c.getY(k)) * (0.6 + 0.4 * smooth(0.04, 0.16, c.getZ(k))); col[k * 3] = 0.45 + lip * 0.75; col[k * 3 + 1] = 0.4 + lip * 0.55; col[k * 3 + 2] = 0.36 + lip * 0.3; }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    parts.push({ geo: g, m });
  }
  scale.dispose();
  // the cap and loop
  parts.push({ geo: turned([[0.001, -0.004], [0.012, -0.006], [0.03, -0.02], [0.036, -0.034], [0.02, -0.04], [0.001, -0.04]], 12, 8) });
  parts.push({ geo: new THREE.TorusGeometry(0.009, 0.0026, 6, 12), m: mtx(0, 0.006, 0) });
  return merge(parts);
}

/** One chain link (flattened oval ring) for an InstancedMesh; stands along y. */
export function linkGeo(): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(0.0062, 0.0017, 5, 10);
  g.scale(0.8, 1.45, 1);
  return g;
}

// ------------------------------------------------------------------ clock hands

/**
 * [clock12] A blued spade hand pointing +y from the arbor (length L), as painted by onboard/clockpaint.ts: a tapered
 * shaft, a spade (the hour hand's bigger, pierced with an oval), a round counterweight tail.
 */
export function handGeo(L: number, kind: 'hour' | 'minute', t = 0.0035): THREE.BufferGeometry {
  const H = kind === 'hour', u = L / (H ? 21 : 30);
  const w = (H ? 1.5 : 1.0) * u, sp = (H ? 4.4 : 2.7) * u, sy = H ? L * 0.68 : L * 0.84, tail = (H ? 5 : 7) * u;
  const s = new THREE.Shape();
  s.moveTo(-w * 0.7, -tail * 0.55);
  s.lineTo(-w * 0.5, sy - sp * 0.2);
  s.bezierCurveTo(-sp * 1.1, sy - sp * 0.5, -sp * 1.1, sy + sp * 0.9, -w * 0.3, sy + sp * 0.95);
  s.lineTo(0, L);
  s.lineTo(w * 0.3, sy + sp * 0.95);
  s.bezierCurveTo(sp * 1.1, sy + sp * 0.9, sp * 1.1, sy - sp * 0.5, w * 0.5, sy - sp * 0.2);
  s.lineTo(w * 0.7, -tail * 0.55);
  s.absarc(0, -tail, w * 1.25, Math.PI / 2 - 0.6, -Math.PI * 1.5 + 0.6, true);
  if (H) { const o = new THREE.Path(); o.absellipse(0, sy + sp * 0.2, sp * 0.3, sp * 0.42, 0, Math.PI * 2, true, 0); s.holes.push(o); }
  return extrude(s, t, t * 0.25, 1, 6);
}

// ------------------------------------------------------------------ fretwork

/** A scalloped bargeboard along +x (length L, height H): a run of half-round scallops with a pierced eye above each. */
export function bargeboard(L: number, H: number, n: number, holes = true): THREE.Shape {
  const s = new THREE.Shape(), r = L / n / 2;
  s.moveTo(0, H);
  s.lineTo(L, H);
  s.lineTo(L, H - r * 0.4);
  for (let i = n - 1; i >= 0; i--) {
    const cx = (i + 0.5) * (L / n);
    s.absarc(cx, H - r * 0.4 - r * 0.15, r, 0, -Math.PI, true);
  }
  s.lineTo(0, H);
  if (holes) for (let i = 0; i < n; i++) s.holes.push(circlePath(r * 0.32, (i + 0.5) * (L / n), H - r * 0.62, 8));
  return s;
}

/** The apron under the case: a plain carved board with two scallops each side and a pointed drop in the middle (as
 * painted by onboard/clockpaint.ts). Top edge at y = 0, hanging down to -H. */
export function apronShape(W: number, H: number): THREE.Shape {
  const s = new THREE.Shape(), w = W / 2, k = H / 18, X = (u: number) => (u / 57) * w;
  s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, -5 * k);
  s.quadraticCurveTo(X(49), -12 * k, X(39), -7 * k);
  s.quadraticCurveTo(X(26), -14 * k, X(13), -9 * k);
  s.quadraticCurveTo(X(5), -15 * k, 0, -H);
  s.quadraticCurveTo(-X(5), -15 * k, -X(13), -9 * k);
  s.quadraticCurveTo(-X(26), -14 * k, -X(39), -7 * k);
  s.quadraticCurveTo(-X(49), -12 * k, -w, -5 * k);
  s.lineTo(-w, 0);
  return s;
}

// ------------------------------------------------------------------ the carved owl crest

export interface Crest { geo: THREE.BufferGeometry; feather: THREE.BufferGeometry; eyes: THREE.BufferGeometry }
/**
 * The crest: a carved owl with wings spread, perched on a branch before a fan of oak leaves (s sets the size: about
 * 0.9 s tall, 1.2 s wide). Three geometries: the leaf fan, branch, discs, beak and talons (carving material), the
 * body, head and wings (feather material, planar uvs), and two amber glass eyes. Origin at the bottom centre.
 */
export function owlCrest(s: number, leafCount = 7, side = 0.3): Crest {
  const carve: Part[] = [], feather: Part[] = [];
  // the fan of leaves behind the bird
  for (let i = 0; i < leafCount; i++) {
    const a = Math.PI / 2 + (i - (leafCount - 1) / 2) * 0.4;
    const g = leafGeo(s * 0.52, s * 0.24, { seed: i + 3, curl: 0.22, fold: 0.1, lobes: 3.5 });
    carve.push({ geo: g, m: new THREE.Matrix4().makeTranslation(0, s * 0.3, 0).multiply(new THREE.Matrix4().makeRotationZ(a)) });
  }
  // the branch it perches on
  const br = new THREE.CatmullRomCurve3([new THREE.Vector3(-s * 0.3, s * 0.13, s * 0.07), new THREE.Vector3(-s * 0.12, s * 0.075, s * 0.12), new THREE.Vector3(s * 0.12, s * 0.075, s * 0.12), new THREE.Vector3(s * 0.3, s * 0.13, s * 0.07)]);
  carve.push({ geo: scaleUV(new THREE.TubeGeometry(br, 18, s * 0.045, 7, false), 3, 0.5) });
  for (const sd of [-1, 1]) carve.push({ geo: turned([[0.0005, 0], [s * 0.045, s * 0.004], [s * 0.036, s * 0.03], [0.0005, s * 0.05]], 8, 20), m: mtx(sd * s * 0.3, s * 0.13, s * 0.07, 0, 0, -sd * Math.PI / 2) });
  // a leaf curling off each end of the branch
  const lie = side > 0.3 ? 0.42 : -0.5;
  for (const sd of [-1, 1]) carve.push({ geo: leafGeo(s * side, s * side * 0.6, { seed: 11 + sd, curl: 0.2, fold: 0.12, lobes: 3.5 }), m: mtx(sd * s * 0.2, s * 0.1, s * 0.03, 0, 0, sd > 0 ? -lie : Math.PI + lie) });
  // wings: feathered trailing edges, raised and spread (the left one is the right one turned round)
  const wing = new THREE.Shape();
  wing.moveTo(0, 0);
  wing.quadraticCurveTo(s * 0.16, s * 0.3, s * 0.5, s * 0.4);
  const nf = 5;
  for (let i = 0; i < nf; i++) {
    const t0 = i / nf, t1 = (i + 1) / nf;
    const x0 = s * (0.5 - t0 * 0.42), y0 = s * (0.4 - t0 * 0.46), x1 = s * (0.5 - t1 * 0.42), y1 = s * (0.4 - t1 * 0.46);
    wing.quadraticCurveTo((x0 + x1) / 2 + s * 0.05, (y0 + y1) / 2 - s * 0.06, x1, y1);
  }
  wing.quadraticCurveTo(s * 0.04, -s * 0.05, 0, 0);
  const wt = s * 0.07;
  const wg = pillow(wing, wt, s * 0.022, 2, 8);
  feather.push({ geo: wg.clone(), m: mtx(s * 0.07, s * 0.27, s * 0.05, 0, 0, 0.1) });
  feather.push({ geo: wg, m: mtx(-s * 0.07, s * 0.27, s * 0.05 + wt, 0, Math.PI, 0.1) });
  // body: an egg
  const body = new THREE.Shape();
  body.moveTo(0, 0);
  body.bezierCurveTo(s * 0.2, 0, s * 0.2, s * 0.32, 0, s * 0.42);
  body.bezierCurveTo(-s * 0.2, s * 0.32, -s * 0.2, 0, 0, 0);
  feather.push({ geo: pillow(body, s * 0.18, s * 0.065, 4, 12), m: mtx(0, s * 0.08, s * 0.07) });
  // head with ear tufts
  const head = new THREE.Shape(), hw = s * 0.15, hh = s * 0.17;
  head.moveTo(-hw, hh * 0.35);
  head.bezierCurveTo(-hw, -hh * 0.25, hw, -hh * 0.25, hw, hh * 0.35);
  head.lineTo(hw * 1.08, hh * 1.08);
  head.quadraticCurveTo(hw * 0.4, hh * 0.72, 0, hh * 0.8);
  head.quadraticCurveTo(-hw * 0.4, hh * 0.72, -hw * 1.08, hh * 1.08);
  head.lineTo(-hw, hh * 0.35);
  feather.push({ geo: pillow(head, s * 0.16, s * 0.05, 4, 12), m: mtx(0, s * 0.47, s * 0.13) });
  // facial discs, beak and talons (carved), eyes (amber glass)
  const hy = s * 0.53;
  for (const sd of [-1, 1]) carve.push({ geo: turned([[0.0005, 0], [s * 0.062, s * 0.006], [s * 0.068, s * 0.018], [s * 0.05, s * 0.028], [0.0005, s * 0.024]], 14, 20), m: mtx(sd * s * 0.064, hy, s * 0.265, Math.PI / 2) });
  carve.push({ geo: turned([[0.0005, 0], [s * 0.024, s * 0.012], [s * 0.014, s * 0.05], [0.0005, s * 0.075]], 8, 20), m: mtx(0, hy - s * 0.035, s * 0.3, -Math.PI * 0.66) });
  const eyes: Part[] = [];
  for (const sd of [-1, 1]) eyes.push({ geo: turned([[0.0005, 0], [s * 0.032, s * 0.003], [s * 0.027, s * 0.017], [0.0005, s * 0.024]], 12, 20), m: mtx(sd * s * 0.064, hy + s * 0.004, s * 0.288, Math.PI / 2) });
  for (const sd of [-1, 1]) for (let k = -1; k <= 1; k++) carve.push({ geo: turned([[0.0005, 0], [s * 0.013, s * 0.01], [s * 0.009, s * 0.04], [0.0005, s * 0.055]], 6, 20), m: mtx(sd * s * 0.07 + k * s * 0.02, s * 0.12, s * 0.17, 0.5, 0, Math.PI) });
  // feather uvs: planar over the bird
  const fg = merge(feather);
  const p = fg.attributes.position as THREE.BufferAttribute, uv = fg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (s * 0.5) + 0.5, p.getY(i) / (s * 0.5));
  return { geo: merge(carve), feather: fg, eyes: merge(eyes) };
}

// ------------------------------------------------------------------ small turned pieces

export const balusterProfile = (h: number, r: number): [number, number][] => [
  [r * 0.9, 0], [r * 0.95, h * 0.06], [r * 0.55, h * 0.12], [r * 0.6, h * 0.2], [r * 1.0, h * 0.36], [r * 0.95, h * 0.48], [r * 0.45, h * 0.62],
  [r * 0.4, h * 0.76], [r * 0.7, h * 0.84], [r * 0.5, h * 0.9], [r * 0.85, h * 0.95], [r * 0.85, h], [0.0005, h],
];
export const columnProfile = (h: number, r: number): [number, number][] => [
  [0.0005, 0], [r * 1.25, 0], [r * 1.25, h * 0.03], [r * 0.95, h * 0.05], [r * 1.05, h * 0.08], [r * 0.8, h * 0.11], [r * 0.82, h * 0.3], [r * 1.05, h * 0.4],
  [r * 0.75, h * 0.47], [r * 0.85, h * 0.5], [r * 0.75, h * 0.53], [r * 1.05, h * 0.6], [r * 0.8, h * 0.7], [r * 0.78, h * 0.89], [r * 1.05, h * 0.92], [r * 0.95, h * 0.95],
  [r * 1.25, h * 0.97], [r * 1.25, h], [0.0005, h],
];
/** A finial: a turned acorn-topped spike for posts and eaves. */
export const finialProfile = (h: number, r: number): [number, number][] => [
  [0.0005, 0], [r * 0.5, 0], [r * 0.45, h * 0.12], [r * 0.9, h * 0.28], [r * 1.0, h * 0.42], [r * 0.85, h * 0.55], [r * 0.4, h * 0.62], [r * 0.55, h * 0.7], [r * 0.6, h * 0.8], [r * 0.3, h * 0.92], [0.0005, h],
];

/** A smooth contact shadow texture (stepped rings, so it reads as a shadow). */
export function blobCanvas(): HTMLCanvasElement {
  const S = 64;
  return paint(S, S, (x, y) => {
    const d = Math.hypot((x + 0.5) / S - 0.5, (y + 0.5) / S - 0.5) * 2;
    const a = Math.round(smooth(1, 0.15, d) * 6) / 6;
    return [20, 12, 6, Math.round(a * 255)];
  });
}

/** A round glow halo for lamp flames (soft, for additive sprites). */
export function haloCanvas(): HTMLCanvasElement {
  const S = 64;
  return paint(S, S, (x, y) => {
    const d = Math.hypot((x + 0.5) / S - 0.5, (y + 0.5) / S - 0.5) * 2;
    const a = Math.pow(clamp01(1 - d), 2.2);
    return [255, 214, 150, Math.round(a * 255)];
  });
}

/** A rng helper for the stage. */
export const seeded = rng;
