// Hoot Hollow's colour grade, "Moss & Moonlight" (see src/gfx/palette.ts and docs/ART-STYLE.md),
// tuned quiet for the interface: mostly neutral paper, linen, wood and ink, colour as an accent.
// calm(colour) takes any colour (the old saturated The Bear Must Eat ramps, a CSS hex, an [r,g,b])
// and moves it into the calm, natural palette: hues pulled to the palette's anchors (reds to
// terracotta and berry, yellows to honey and lamp, greens to moss, blues to lake and dusk, purples
// to lilac and plum), chroma softly capped per hue family, blacks lifted to warm ink and whites
// settled to oat paper. Colours already in the palette come back nearly unchanged, so it is safe
// to apply twice. Pure; no DOM. OWNED BY THE UI BUILDER (ui3).

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };

function toLab(r, g, b) {
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromLabRaw(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (c) => c.every((v) => v >= -0.0005 && v <= 1.0005);
function fromLch(L, C, h) {
  const a = (h * Math.PI) / 180;
  let c = C, rgb = fromLabRaw(L, Math.cos(a) * c, Math.sin(a) * c);
  for (let i = 0; i < 24 && !inGamut(rgb); i++) { c *= 0.92; rgb = fromLabRaw(L, Math.cos(a) * c, Math.sin(a) * c); }
  return rgb.map(gam);
}

// hue remap (OKLCH degrees): [from, to] control points, piecewise linear, wraps at 360
// [ui4] the pull toward the palette's anchors is half as strong as v3 (emerald stays emerald, sapphire stays sapphire)
const HUE = [[0, 14], [12, 20], [28, 32], [50, 46], [66, 64], [80, 76], [92, 84], [112, 108], [142, 130], [158, 140], [180, 176], [205, 206], [232, 224], [255, 236], [275, 252], [292, 296], [318, 318], [342, 352], [360, 374]].map(([a, b]) => [a, a + (b - a) * 0.4]);
function remapHue(h) {
  for (let i = 1; i < HUE.length; i++) {
    const [a0, b0] = HUE[i - 1], [a1, b1] = HUE[i];
    if (h <= a1) return (b0 + ((h - a0) / (a1 - a0)) * (b1 - b0)) % 360;
  }
  return h;
}
// chroma ceiling per hue family (after the remap)
function cmax(h) {
  const pts = [[0, 0.085], [30, 0.088], [50, 0.08], [66, 0.07], [80, 0.092], [92, 0.095], [110, 0.085], [140, 0.08], [175, 0.05], [215, 0.05], [250, 0.055], [300, 0.06], [340, 0.07], [360, 0.085]];
  for (let i = 1; i < pts.length; i++) if (h <= pts[i][0]) { const [a0, c0] = pts[i - 1], [a1, c1] = pts[i]; return c0 + ((h - a0) / (a1 - a0)) * (c1 - c0); }
  return 0.085;
}

// [ui4] v4 "Golden Diorama": the interface is rich and warm again (honey and walnut woods, emerald,
// sapphire, oxblood, brass gold, sky blue), still natural: every hue family's ceiling is scaled by this
// (1 = the calm palette's own strength; v3 used 0.6).
const QUIET = 1.55;

const cache = new Map();
/** Grade one colour into the calm palette. Accepts '#rgb', '#rrggbb', '#rrggbbaa' or [r,g,b(,a)]. Returns the same kind. */
export function calm(c) {
  if (typeof c === 'string') {
    const hit = cache.get(c);
    if (hit) return hit;
    let s = c.replace('#', '');
    if (s.length <= 4) s = s.split('').map((ch) => ch + ch).join('');
    const n = parseInt(s.slice(0, 6), 16);
    const out = calmRGB([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    const hex = '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('') + (s.length >= 8 ? s.slice(6, 8) : '');
    cache.set(c, hex);
    return hex;
  }
  const o = calmRGB(c);
  return c.length > 3 ? [...o, c[3]] : o;
}

/** The grade on an [r,g,b] triple. */
export function calmRGB(rgb) {
  const [L0, A, B] = toLab(rgb[0], rgb[1], rgb[2]);
  const C0 = Math.hypot(A, B);
  let h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  // greys get the paper's warmth instead of a hue
  const grey = C0 < 0.012;
  if (grey) h = 86;
  else h = remapHue(h);
  // lightness: lift blacks to warm ink, settle whites to oat paper
  let L = Math.max(L0, 0.15 + L0 * 0.42);
  L = Math.min(L, 0.955 + (L0 - 0.95) * 0.3);
  // chroma: a soft knee under a per-hue ceiling; very light and very dark colours stay quieter
  let Cm = cmax(h) * QUIET;
  if (L > 0.88) Cm *= Math.max(0.22, 1 - (L - 0.88) * 18); // pale colours settle into oat and linen paper
  if (L < 0.38) Cm *= 0.45 + (L / 0.38) * 0.55;
  const k = Cm * 0.62;
  let C = C0 <= k ? C0 : k + (Cm - k) * Math.tanh((C0 - k) / (Cm - k));
  if (grey) C = Math.max(C0, L > 0.9 ? 0.012 : L < 0.35 ? 0.011 : 0.008);
  // shadows lean cool (towards slate), highlights lean warm (towards lamp)
  const r = (h * Math.PI) / 180;
  let a = Math.cos(r) * C, b = Math.sin(r) * C;
  if (L < 0.44 && h > 15 && h < 115) { const t = Math.min(0.75, (0.44 - L) * 3.6); a += (0.0005 - a) * t; b += (0.013 - b) * t; } // warm darks settle into the ink
  else if (L < 0.42) { const t = (0.42 - L) * 0.55; a += (-0.0146 - a) * t; b += (-0.0329 - b) * t; }
  else if (L > 0.84) { const t = (L - 0.84) * 0.5; a += (0.0099 - a) * t; b += (0.0804 - b) * t; }
  return fromLch(L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360);
}

/** Grade a 6-tone ramp (array of '#hex', dark to light), keeping its tone spacing. */
export function calmRamp(r) { return r.map((c) => calm(c)); }

/** Replace every '#hex' and rgb()/rgba() in a CSS string with its calm grade. */
export function calmCSS(css) {
  return css
    .replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => (m.length === 4 || m.length === 7 || m.length === 9 || m.length === 5 ? calm(m) : m))
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => { const o = calmRGB([+r, +g, +b]); return a ? `rgba(${o[0]}, ${o[1]}, ${o[2]}${a})` : `rgb(${o[0]}, ${o[1]}, ${o[2]})`; });
}
