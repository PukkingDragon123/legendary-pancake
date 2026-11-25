// [icons8] The pixel-art finish: turns a supersampled 3D render (colour, a material id per sample and depth) into a
// hand-finished pixel-art sprite at its art size, the way a pixel artist would paint over a 3D render:
//   - a hard silhouette (a pixel is in when most of it is covered; one-pixel-thin parts are kept as clean lines)
//   - every material gets its own short colour ramp (k-means in OKLab), and the ramp is hue-shifted: shadows turn cool
//     (towards violet, or teal for greens) and stay saturated, mid-tones calm down a little, highlights turn warm
//     (towards gold, or cyan for blues) and pale; neighbouring steps keep a clear contrast
//   - stray single pixels are folded into their neighbours (clean clusters, no noise)
//   - inner lines where one part passes in front of another (the part behind gets its darkest shade)
//   - [icons9] a crisp near-black outline (#120a10) round the silhouette and round holes, to match the outlined 3D
//     world; edge pixels the true outline only clips lean a little towards it, snapped to the material's own shades
//     (anti-aliasing with the sprite's own colours)
//   - single-pixel glints on glossy materials (metal, glass, gems, enamel) at their brightest point
//   - optionally a hard, faint drop shadow one pixel down and right
// Used by the icon bake (src/dev/iconbake.ts) for the icons and the shelf's sprites. Dev only.

export type Lab = [number, number, number];
export interface Passes {
  /** the art size */
  w: number; h: number;
  /** supersampling: the passes are (w * s) x (h * s) */
  s: number;
  /** the lit render, unpremultiplied RGBA */
  rgba: Uint8ClampedArray;
  /** the material id of each sample (-1 = nothing) */
  id: Int32Array;
  /** each sample's depth, 0 near .. 1 far (1 = nothing) */
  depth: Float32Array;
}
export interface Group {
  /** glossy (metal, glass, gem, glaze): gets glints */
  glossy?: boolean;
  /** emissive (flame, lamp light): warm both ways, no cool shadows, no inner lines */
  glow?: boolean;
  /** the most colour steps this material may have */
  steps?: number;
  /** no outline next to this material (a glow) */
  noOutline?: boolean;
  /** smoothing of the texture before quantising (0 keeps all its detail, 1 is broad shading only) */
  smooth?: number;
  /** a material that never gets inner lines (paint on a surface) */
  flat?: boolean;
}
export interface Opts {
  groups: (id: number) => Group;
  /** the small size: fewer steps, fewer lines */
  tiny?: boolean;
  /** [icons9] the large (44 art px) size: a step more per material and less smoothing, so texture detail survives */
  hd?: boolean;
  /** a faint hard shadow 1 px down and right */
  shadow?: boolean;
  /** how far in front (depth units) a neighbour must be to draw an inner line */
  lineDepth?: number;
}
export interface Art {
  w: number; h: number; d: Uint8ClampedArray;
  /** [icons9] each pixel's material (-1 = outline, shadow or nothing), for touches that keep to one material */
  g?: Int32Array;
}
/** [icons9] the outline: a warm near-black, never a hue-shifted local colour */
export const OUTLINE_RGB: [number, number, number] = [18, 10, 16];

// ------------------------------------------------------------------ colour (OKLab)
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const enc = (v: number) => { v = clamp(v); return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255); };
export function linToLab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function labToLin(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
export const rgbToLab = (r: number, g: number, b: number): Lab => linToLab(LIN[r], LIN[g], LIN[b]);
/** OKLab to 8-bit sRGB, pulling chroma in until it fits the gamut */
export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  L = clamp(L, 0, 1);
  let k = 1;
  for (let i = 0; i < 14; i++) {
    const c = labToLin(L, a * k, b * k);
    if (c[0] >= -1e-4 && c[0] <= 1.0001 && c[1] >= -1e-4 && c[1] <= 1.0001 && c[2] >= -1e-4 && c[2] <= 1.0001) return [enc(c[0]), enc(c[1]), enc(c[2])];
    k *= 0.86;
  }
  const c = labToLin(L, 0, 0);
  return [enc(c[0]), enc(c[1]), enc(c[2])];
}
const lch = (c: Lab): [number, number, number] => [c[0], Math.hypot(c[1], c[2]), ((Math.atan2(c[2], c[1]) * 180) / Math.PI + 360) % 360];
const fromLch = (L: number, C: number, h: number): Lab => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
/** turn hue h towards `to` by at most `by` degrees, the short way round */
function toward(h: number, to: number, by: number): number {
  let d = to - h;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return (h + Math.sign(d) * Math.min(Math.abs(d), by) + 360) % 360;
}
const inHue = (h: number, a: number, b: number) => (a <= b ? h >= a && h < b : h >= a || h < b);

/**
 * A step of a material's ramp, hue-shifted by where it sits: u = -1 its deepest shadow .. 0 its mid-tone .. 1 its
 * brightest light.
 */
export function shiftStep(c: Lab, u: number, glow = false): Lab {
  let [L, C, h] = lch(c);
  const t = Math.abs(u);
  if (glow) {
    if (u < 0) { h = toward(h, 32, 16 * t); C *= 1 + 0.1 * t; }
    else { h = toward(h, 95, 18 * t); C *= 1 - 0.35 * t; L += 0.03 * t; }
    return fromLch(clamp(L), C, h);
  }
  const neutral = C < 0.022;
  if (u < 0) {
    const cool = inHue(h, 95, 178) ? 200 : 298;
    if (neutral) { h = 290; C = Math.max(C, 0.03 * t); } else { h = toward(h, cool, 30 * t); C = Math.max(C * (1 + 0.14 * t), 0.03 * t); }
    L -= 0.02 * t;
  } else {
    const warm = inHue(h, 178, 292) ? 210 : 86;
    if (neutral) { h = 82; C = Math.max(C, 0.022 * t); } else { h = toward(h, warm, 20 * t); C *= 1 - 0.16 * t; }
    L += 0.015 * t;
  }
  C *= 1 - 0.07 * (1 - t); // calmer mid-tones
  return fromLch(clamp(L), C, h);
}

// ------------------------------------------------------------------ the finish
interface Px { cov: number; a: number; lab: Lab; g: number; d: number; lum: number }

export function pixelize(P: Passes, o: Opts): Art {
  const { w, h, s } = P, W = w * s, N = w * h;
  const tiny = !!o.tiny, hd = !!o.hd && !tiny;
  // ---- downsample: coverage, colour (linear mean, alpha weighted), material (majority), depth (front-most)
  const px: Px[] = new Array(N);
  const counts = new Map<number, number>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0, aw = 0, r = 0, g = 0, b = 0, as = 0, dmin = 1;
    counts.clear();
    for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
      const i = (y * s + sy) * W + x * s + sx, a = P.rgba[i * 4 + 3] / 255, id = P.id[i];
      if (a < 0.03 && id < 0) continue;
      n++;
      as += a;
      const k = Math.max(0.05, a);
      aw += k; r += LIN[P.rgba[i * 4]] * k; g += LIN[P.rgba[i * 4 + 1]] * k; b += LIN[P.rgba[i * 4 + 2]] * k;
      if (id >= 0) counts.set(id, (counts.get(id) ?? 0) + 1);
      if (P.depth[i] < dmin) dmin = P.depth[i];
    }
    let best = -2, bc = 0;
    for (const [id, c] of counts) if (c > bc) { bc = c; best = id; }
    const lab = n ? linToLab(r / aw, g / aw, b / aw) : ([0, 0, 0] as Lab);
    px[y * w + x] = { cov: n / (s * s), a: as / (s * s), lab, g: best, d: dmin, lum: lab[0] };
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : px[y * w + x]);
  // ---- the silhouette: mostly covered, or a thin part's ridge (so a chain or a wire stays a clean line)
  const solid = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = px[y * w + x];
    if (p.cov >= 0.5) { solid[y * w + x] = 1; continue; }
    if (p.cov < 0.22) continue;
    const cv = (dx: number, dy: number) => at(x + dx, y + dy)?.cov ?? 0;
    const cl = cv(-1, 0), cr = cv(1, 0), cu = cv(0, -1), cd = cv(0, 1), T = 0.18;
    // a ridge across one axis that runs on along the other (a corner of a round shape is not a line)
    const vLine = p.cov >= cl && p.cov >= cr && cl < 0.5 && cr < 0.5 && cu >= T && cd >= T;
    const hLine = p.cov >= cu && p.cov >= cd && cu < 0.5 && cd < 0.5 && cl >= T && cr >= T;
    const dLine = (cv(-1, -1) >= T && cv(1, 1) >= T && cv(1, -1) < 0.3 && cv(-1, 1) < 0.3) || (cv(1, -1) >= T && cv(-1, 1) >= T && cv(-1, -1) < 0.3 && cv(1, 1) < 0.3);
    if (vLine || hLine || (dLine && cl < 0.5 && cr < 0.5 && cu < 0.5 && cd < 0.5)) solid[y * w + x] = 1;
  }
  // a pixel with no material of its own takes its neighbours'
  for (let i = 0; i < N; i++) if (solid[i] && px[i].g < 0) {
    const x = i % w, y = (i / w) | 0;
    for (const q of [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]) if (q && q.g >= 0) { px[i].g = q.g; break; }
  }
  // ---- a little smoothing inside each material, so a busy texture becomes clean shapes
  const smoothLab: Lab[] = px.map((p) => p.lab);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = px[i];
    if (!solid[i]) continue;
    const k = o.groups(p.g).smooth ?? (tiny ? 0.5 : hd ? 0.22 : 0.35);
    if (k <= 0) continue;
    let L = 0, A = 0, B = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const q = at(x + dx, y + dy);
      if (!q || !solid[(y + dy) * w + x + dx] || q.g !== p.g) continue;
      const wgt = dx || dy ? 1 : 2;
      L += q.lab[0] * wgt; A += q.lab[1] * wgt; B += q.lab[2] * wgt; n += wgt;
    }
    smoothLab[i] = [p.lab[0] * (1 - k) + (L / n) * k, p.lab[1] * (1 - k) + (A / n) * k, p.lab[2] * (1 - k) + (B / n) * k];
  }
  // ---- one ramp per material
  const groups = new Map<number, number[]>();
  for (let i = 0; i < N; i++) if (solid[i]) { const g = px[i].g; let l = groups.get(g); if (!l) groups.set(g, (l = [])); l.push(i); }
  const idx = new Int16Array(N).fill(-1);
  const ramps = new Map<number, Lab[]>();
  const WL = 1.7;
  const dist = (a: Lab, b: Lab) => ((a[0] - b[0]) * WL) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  for (const [g, list] of groups) {
    const info = o.groups(g);
    const labs = list.map((i) => smoothLab[i]);
    const Ls = labs.map((c) => c[0]).sort((a, b) => a - b);
    const q = (f: number) => Ls[Math.min(Ls.length - 1, Math.floor(f * Ls.length))];
    const spread = q(0.95) - q(0.05);
    let K = Math.round(1 + Math.log2(list.length) / 1.55);
    K = Math.min(K, info.steps ?? (tiny ? 4 : hd ? 7 : 6), list.length);
    if (spread < 0.04) K = Math.min(K, 2); else if (spread < 0.09) K = Math.min(K, 3);
    K = Math.max(1, K);
    // k-means, started at the brightness quantiles
    let cents: Lab[] = [];
    const sorted = list.map((_, k) => k).sort((a, b) => labs[a][0] - labs[b][0]);
    for (let k = 0; k < K; k++) {
      const from = Math.floor((k / K) * sorted.length), to = Math.max(from + 1, Math.floor(((k + 1) / K) * sorted.length));
      let L = 0, A = 0, B = 0;
      for (let j = from; j < to; j++) { const c = labs[sorted[j]]; L += c[0]; A += c[1]; B += c[2]; }
      cents.push([L / (to - from), A / (to - from), B / (to - from)]);
    }
    const asg = new Int16Array(list.length);
    for (let it = 0; it < 12; it++) {
      for (let j = 0; j < labs.length; j++) { let bi = 0, bd = 1e9; for (let k = 0; k < cents.length; k++) { const d = dist(labs[j], cents[k]); if (d < bd) { bd = d; bi = k; } } asg[j] = bi; }
      const sum = cents.map(() => [0, 0, 0, 0]);
      for (let j = 0; j < labs.length; j++) { const t = sum[asg[j]]; t[0] += labs[j][0]; t[1] += labs[j][1]; t[2] += labs[j][2]; t[3]++; }
      const next: Lab[] = [];
      sum.forEach((t) => { if (t[3]) next.push([t[0] / t[3], t[1] / t[3], t[2] / t[3]]); });
      // merge steps too close to tell apart
      next.sort((a, b) => a[0] - b[0]);
      const merged: Lab[] = [];
      for (const c of next) { const last = merged[merged.length - 1]; if (last && dist(last, c) < 0.0016) { merged[merged.length - 1] = [(last[0] + c[0]) / 2, (last[1] + c[1]) / 2, (last[2] + c[2]) / 2]; } else merged.push(c); }
      cents = merged;
    }
    for (let j = 0; j < labs.length; j++) { let bi = 0, bd = 1e9; for (let k = 0; k < cents.length; k++) { const d = dist(labs[j], cents[k]); if (d < bd) { bd = d; bi = k; } } idx[list[j]] = bi; }
    // the hue-shifted ramp
    const counts2 = cents.map(() => 0);
    for (const i of list) counts2[idx[i]]++;
    let mean = 0;
    cents.forEach((c, k) => (mean += c[0] * counts2[k]));
    mean /= list.length;
    const lo = cents[0][0], hi = cents[cents.length - 1][0], half = Math.max(0.07, (hi - lo) / 2);
    const ramp = cents.map((c) => shiftStep(c, clamp((c[0] - mean) / half, -1, 1), info.glow));
    // enough contrast to model the form: a ramp of three or more steps spans at least `span` in lightness
    const span = (tiny ? 0.3 : 0.36) * Math.min(1, (ramp.length - 1) / 4);
    if (!info.glow && ramp.length > 2 && ramp[ramp.length - 1][0] - ramp[0][0] < span) {
      const lo0 = ramp[0][0], hi0 = ramp[ramp.length - 1][0], m0 = (lo0 + hi0) / 2, k = span / Math.max(0.02, hi0 - lo0);
      for (let j = 0; j < ramp.length; j++) ramp[j] = [clamp(m0 + (ramp[j][0] - m0) * k, 0.08, 0.97), ramp[j][1], ramp[j][2]];
    }
    // a clear step between neighbouring shades
    const gap = tiny ? 0.075 : 0.06;
    for (let pass = 0; pass < 3; pass++) for (let k = 1; k < ramp.length; k++) {
      const d = ramp[k][0] - ramp[k - 1][0];
      if (d < gap) { const f = (gap - d) / 2; ramp[k - 1] = [Math.max(0.06, ramp[k - 1][0] - f), ramp[k - 1][1], ramp[k - 1][2]]; ramp[k] = [Math.min(0.985, ramp[k][0] + f), ramp[k][1], ramp[k][2]]; }
    }
    ramps.set(g, ramp);
  }
  // ---- clean clusters: a lone pixel joins its neighbours
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!solid[i]) continue;
    const g = px[i].g, me = idx[i];
    const nb: number[] = [];
    let same = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * w + xx;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !solid[j] || px[j].g !== g) continue;
      nb.push(idx[j]);
      if (idx[j] === me) same++;
    }
    if (same || nb.length < 3) continue;
    const tally = new Map<number, number>();
    for (const v of nb) tally.set(v, (tally.get(v) ?? 0) + 1);
    let bv = me, bc = 0;
    for (const [v, c] of tally) if (c > bc || (c === bc && Math.abs(v - me) < Math.abs(bv - me))) { bc = c; bv = v; }
    idx[i] = bv;
  }
  const out = new Float32Array(N * 4); // OKLab + alpha
  const put = (i: number, c: Lab, a = 1) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = a; };
  for (let i = 0; i < N; i++) if (solid[i]) put(i, ramps.get(px[i].g)![idx[i]]);
  // ---- inner lines: the part behind gets its darkest shade where another passes in front of it
  const lineD = o.lineDepth ?? (tiny ? 0.11 : 0.06);
  const isLine = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!solid[i]) continue;
    const p = px[i], gi = o.groups(p.g);
    if (gi.glow || gi.flat) continue;
    let front = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * w + xx;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !solid[j]) continue;
      const q = px[j], dd = p.d - q.d;
      if (o.groups(q.g).glow) continue;
      if (dd > lineD || (q.g !== p.g && dd > lineD * 0.45)) { front = true; break; }
    }
    if (!front) continue;
    const ramp = ramps.get(p.g)!;
    if (idx[i] === 0 && ramp.length > 1) { const c = ramp[0]; put(i, [c[0] * 0.86, c[1] * 1.05, c[2] * 1.05]); }
    else put(i, ramp[0]);
    isLine[i] = 1;
  }
  // ---- glints: the brightest point of a glossy material
  const glints: number[] = [];
  for (const [g, list] of groups) {
    const info = o.groups(g);
    if (!info.glossy || list.length < (tiny ? 10 : 14)) continue;
    const ramp = ramps.get(g)!;
    const cands = list.filter((i) => !isLine[i] && idx[i] === ramp.length - 1).sort((a, b) => px[b].lum - px[a].lum);
    const want = tiny ? 1 : list.length > 120 ? 2 : 1;
    const picked: number[] = [];
    for (const i of cands) {
      if (picked.length >= want) break;
      const x = i % w, y = (i / w) | 0;
      if (picked.some((j) => Math.abs((j % w) - x) + Math.abs(((j / w) | 0) - y) < 4)) continue;
      // a glint sits inside the shape, not on its rim
      let inside = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h || !solid[yy * w + xx]) inside = false; }
      if (!inside) continue;
      picked.push(i);
    }
    for (const i of picked) { const top = ramp[ramp.length - 1], [, C, hh] = lch(top); put(i, fromLch(Math.min(0.985, top[0] + 0.08), C * 0.45, toward(hh, 90, 30))); glints.push(i); }
  }
  // ---- the outline round the silhouette (and round holes): crisp near-black
  const outline = new Uint8Array(N);
  const ink = rgbToLab(...OUTLINE_RGB);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid[i]) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * w + xx;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !solid[j] || o.groups(px[j].g).noOutline) continue;
      near = true;
      break;
    }
    if (!near) continue;
    put(i, ink, 1);
    outline[i] = 1;
  }
  // ---- anti-aliasing with the sprite's own colours: an edge pixel the outline only clips leans towards it
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!solid[i] || isLine[i] || glints.includes(i)) continue;
    const p = px[i];
    if (p.cov >= 0.86) continue;
    let oc = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, j = yy * w + xx; if (xx >= 0 && yy >= 0 && xx < w && yy < h && outline[j]) { oc = j; break; } }
    if (oc < 0) continue;
    const t = clamp((0.86 - p.cov) * 0.9, 0, 0.42);
    const ramp = ramps.get(p.g)!;
    // blend, then snap to the nearest of the material's shades and the outline colour
    const mixed: Lab = [out[i * 4] + (out[oc * 4] - out[i * 4]) * t, out[i * 4 + 1] + (out[oc * 4 + 1] - out[i * 4 + 1]) * t, out[i * 4 + 2] + (out[oc * 4 + 2] - out[i * 4 + 2]) * t];
    let best: Lab = mixed, bd = 1e9;
    for (const c of [...ramp, [out[oc * 4], out[oc * 4 + 1], out[oc * 4 + 2]] as Lab]) { const d = dist(mixed, c); if (d < bd) { bd = d; best = c; } }
    put(i, best);
  }
  // ---- out to RGBA (with the faint shadow)
  const d = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    if (!out[i * 4 + 3]) continue;
    const [r, g, b] = labToRgb(out[i * 4], out[i * 4 + 1], out[i * 4 + 2]);
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = Math.round(out[i * 4 + 3] * 255);
  }
  const gid = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) if (solid[i]) gid[i] = px[i].g;
  if (o.shadow) {
    for (let y = h - 1; y >= 1; y--) for (let x = w - 1; x >= 1; x--) {
      const i = y * w + x, j = (y - 1) * w + x - 1;
      if (d[i * 4 + 3] || !d[j * 4 + 3]) continue;
      d[i * 4] = 40; d[i * 4 + 1] = 20; d[i * 4 + 2] = 26; d[i * 4 + 3] = 64;
    }
  }
  return { w, h, d, g: gid };
}
