// [icons9] The icon finish: turns a supersampled 3D render (colour, a material id per sample and depth) into an icon at
// its size:
//   - the render's own textures (wood grain, brass, leather, cloth, paper, glass) and realistic light, at full colour
//   - smooth edges: every output pixel is the average of its samples (no palette, no pixel snapping)
//   - an optional dark edge round the silhouette (`outline` px wide, `outlineAlpha` strong: a faint one for realistic
//     icons, so they stand off the panels)
//   - optional fine dark lines where one part passes in front of another (`ink`)
// Twinkles for the idle frames are laid on afterwards by the bake (src/dev/iconbake.ts). Dev only.

export interface Passes {
  /** the output size */
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
  /** glossy (metal, glass, gem, glaze): gets painted highlights */
  glossy?: boolean;
  /** emissive (flame, lamp light): no ink lines on or against it */
  glow?: boolean;
  /** no outline next to this material */
  noOutline?: boolean;
  /** paint on a surface: no ink lines */
  flat?: boolean;
}
export interface Opts {
  groups: (id: number) => Group;
  /** the outline's width in output pixels */
  outline: number;
  /** [icons9] how dark the outline is (1 = solid near-black; a faint edge for realistic icons) */
  outlineAlpha?: number;
  /** the inner ink lines' width in output pixels (0: none) */
  ink?: number;
  /** how far in front (depth units) a neighbour must be to draw an ink line */
  lineDepth?: number;
}
export interface Art {
  w: number; h: number; d: Uint8ClampedArray;
  /** each output pixel's main material (-1 = outline or nothing), for touches that keep to one material */
  g?: Int32Array;
}
/** the outline: a warm near-black */
export const OUTLINE_RGB: [number, number, number] = [18, 10, 16];

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const enc = (v: number) => { v = clamp(v); return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255); };

/** distance (in samples) from every sample to the nearest solid one: a two-pass 3-4 chamfer, good to a few percent */
function distanceField(solid: Uint8Array, W: number, H: number): Float32Array {
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = solid[i] ? 0 : INF;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + a);
    if (y > 0) { v = Math.min(v, d[i - W] + a); if (x > 0) v = Math.min(v, d[i - W - 1] + b); if (x < W - 1) v = Math.min(v, d[i - W + 1] + b); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + a);
    if (y < H - 1) { v = Math.min(v, d[i + W] + a); if (x < W - 1) v = Math.min(v, d[i + W + 1] + b); if (x > 0) v = Math.min(v, d[i + W - 1] + b); }
    d[i] = v;
  }
  return d;
}

export function paintFinish(P: Passes, o: Opts): Art {
  const { w, h, s } = P, W = w * s, H = h * s, N = W * H;
  const solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) solid[i] = P.id[i] >= 0 || P.rgba[i * 4 + 3] > 127 ? 1 : 0;
  // ---- ink lines: a sample behind a nearer part, within the line's width of it, is inked
  const ink = new Float32Array(N);
  const r = Math.max(1, Math.round((o.ink ?? 0) * s)), lineD = o.lineDepth ?? 0.05;
  if ((o.ink ?? 0) > 0) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!solid[i]) continue;
      const gi = o.groups(P.id[i]);
      if (gi.glow || gi.flat) continue;
      let best = 99;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy, dd = dx * dx + dy * dy;
        if (dd > r * r || dd >= best || xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (!solid[j] || o.groups(P.id[j]).glow) continue;
        const dz = P.depth[i] - P.depth[j];
        if (dz > lineD || (P.id[j] !== P.id[i] && dz > lineD * 0.45)) best = dd;
      }
      if (best < 99) ink[i] = 1 - Math.sqrt(best) / (r + 1) * 0.35;
    }
  }
  // ---- the outline: a band round the silhouette, its outer edge anti-aliased
  const noOut = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (solid[i] && o.groups(P.id[i]).noOutline) noOut[i] = 1;
  const dist = distanceField(solid, W, H);
  const R = o.outline * s;
  // ---- compose at the samples (linear light, premultiplied), then average down
  const out = new Uint8ClampedArray(w * h * 4);
  const ol = [LIN[OUTLINE_RGB[0]], LIN[OUTLINE_RGB[1]], LIN[OUTLINE_RGB[2]]];
  const gOut = new Int32Array(w * h).fill(-1);
  const tally = new Map<number, number>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let ar = 0, ag = 0, ab = 0, aa = 0;
    tally.clear();
    for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
      const i = (y * s + sy) * W + x * s + sx;
      let cr = 0, cg = 0, cb = 0, ca = 0;
      // the outline underneath
      if (!solid[i] && dist[i] < R + 1) {
        const k = clamp(R + 0.5 - dist[i]) * (o.outlineAlpha ?? 1);
        cr = ol[0] * k; cg = ol[1] * k; cb = ol[2] * k; ca = k;
      }
      if (solid[i]) {
        const a = P.rgba[i * 4 + 3] / 255;
        let r0 = LIN[P.rgba[i * 4]], g0 = LIN[P.rgba[i * 4 + 1]], b0 = LIN[P.rgba[i * 4 + 2]];
        if (ink[i] > 0) { const k = 0.8 * ink[i]; r0 = r0 * (1 - k) + r0 * 0.12 * k + ol[0] * k * 0.3; g0 = g0 * (1 - k) + g0 * 0.1 * k + ol[1] * k * 0.3; b0 = b0 * (1 - k) + b0 * 0.14 * k + ol[2] * k * 0.3; }
        // a see-through part (glass) lies over the outline colour only where the outline is; elsewhere it stays clear
        cr = r0 * a + cr * (1 - a); cg = g0 * a + cg * (1 - a); cb = b0 * a + cb * (1 - a); ca = a + ca * (1 - a);
        const id = P.id[i];
        if (id >= 0) tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      ar += cr; ag += cg; ab += cb; aa += ca;
    }
    const n = s * s, j = (y * w + x) * 4;
    if (aa > 0) { out[j] = enc(ar / aa); out[j + 1] = enc(ag / aa); out[j + 2] = enc(ab / aa); out[j + 3] = Math.round((aa / n) * 255); }
    let bg = -1, bc = 0;
    for (const [id, c] of tally) if (c > bc) { bc = c; bg = id; }
    if (bc * 2 >= n) gOut[y * w + x] = bg;
  }
  void noOut;
  return { w, h, d: out, g: gOut };
}
