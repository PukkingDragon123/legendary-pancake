// [ui5, ui7] The portrait frames (a cosmetic, see src/assets/frames.ts): eleven round frames for the live owl
// portrait, each a real object modelled with the material painter (src/ui/real/paint.ts) at device resolution:
// a polished brass porthole, carved walnut, a mossy willow ring with mushrooms, cranberry cable knit, silver
// filigree with pearls, a toadstool fairy ring, a golden laurel wreath, frost crystals, a celestial orrery, iced
// gingerbread and a ring of night sky studded with gold stars. Lit from the top left with soft shadows; the
// opening is cut clear and the owl (src/ui/chrome/livepip.tsx) shows through it over a little painted sky.
import {
  BRASS_OLD, GOLD, Real, SILVER, bevel, box, cached, circle, clamp, cloth, deviceK, dome, ellipse, enamel, fbm, glass, hex, metal, mix, paperMat, pillow,
  polygon, rim, ring, rotate, segment, subtract, toURL, union, vnoise, warp, wood, type Material, type RGB, type SDF,
} from '../real/paint.ts';

/** design units across a frame */
export const FRAME_D = 38;
const C = FRAME_D / 2;
/** the opening's radius in design units (the owl shows inside it) */
export const FRAME_OPEN = 12.6;
const R1 = 17.4;
const mid = (FRAME_OPEN + R1) / 2, half = (R1 - FRAME_OPEN) / 2;

const at = (a: number, r: number): [number, number] => [C + Math.cos(a) * r, C + Math.sin(a) * r];
const band = (r0 = FRAME_OPEN - 0.4, r1 = R1) => ring(C, C, r0, r1);
/** a round ring's cross-section: a half-round (torus) of height h over the band */
const torusH = (h: number, rm = mid, hw = half, base = 0) => (x: number, y: number) => base + h * Math.sqrt(Math.max(0, 1 - ((Math.hypot(x - C, y - C) - rm) / hw) ** 2));
const leaf = (cx: number, cy: number, len: number, wid: number, a: number): SDF => rotate(ellipse(cx, cy, len / 2, wid / 2), a, cx, cy);
function star(cx: number, cy: number, R: number, r0 = 0.45, rot = -Math.PI / 2, n = 5): SDF {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? R * r0 : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return polygon(pts);
}
const gold = (p = 0.8) => metal(GOLD, { polish: p });
const silver = (p = 0.85) => metal(SILVER, { polish: p });

type Paint = (r: Real) => void;
const PAINT: Record<string, Paint> = {
  // a ship's porthole: a fat polished brass ring, a moulded inner lip, eight domed bolts
  porthole: (r) => {
    r.part(band(), torusH(4.2), gold(0.85));
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 1.5), torusH(1.6, FRAME_OPEN + 0.55, 0.95, 3.2), metal(BRASS_OLD, { polish: 0.7 }));
    for (let i = 0; i < 8; i++) { const [x, y] = at(-Math.PI / 8 + (i * Math.PI) / 4, mid + 0.5); r.part(circle(x, y, 1.15), dome(x, y, 1.15, 1.15, 1.2, 4.2), gold(0.9)); }
  },
  // carved walnut: oiled grain, a beaded outer edge, a cove on the inside, four carved leaves
  walnut: (r) => {
    r.part(band(), torusH(3.6), wood('walnut', { along: 'x', scale: 5 }));
    for (let i = 0; i < 28; i++) { const [x, y] = at((i / 28) * Math.PI * 2, R1 - 0.75); r.carve(circle(x, y, 0.42), 0.7, 0.35); }
    r.carve(ring(C, C, FRAME_OPEN + 1.4, FRAME_OPEN + 2.1), 0.8, 0.35);
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 2, [x, y] = at(a, mid + 0.4); r.part(leaf(x, y, 4.4, 1.9, a + Math.PI / 2), (px, py) => torusH(3.6)(px, py) + 0.8, wood('walnut', { along: 'y', scale: 5, ox: 40 })); r.carve(segment(...at(a, mid + 0.4 - 0.01), ...at(a, mid + 0.4 + 0.01), 0.15), 0.4, 0.2); }
  },
  // a willow twig bent into a ring: bark, clumps of moss, two red mushrooms and a fresh leaf
  moss: (r) => {
    const bark: Material = { alb: (x, y) => { const a = Math.atan2(y - C, x - C) * 12, d = Math.hypot(x - C, y - C); const v = vnoise(a * 2, d * 2.5, 5); return mix(hex('#6a4a2c'), hex('#a8825a'), clamp(v * 1.2 - 0.1)) as RGB; }, spec: 0.08, shin: 6 };
    r.part(warp(band(FRAME_OPEN - 0.3, R1 - 0.8), 0.35, 0.5, 3), torusH(3.4, mid - 0.4, half - 0.4), bark);
    const moss = cloth('felt', hex('#5e8a2e'), { scale: 6, amt: 1.2 });
    for (const [a, s] of [[-2.5, 3.2], [-1.4, 2.6], [0.2, 3], [1.5, 2.4], [2.6, 2.8]] as [number, number][]) {
      const [x, y] = at(a, mid + 0.6);
      r.part(warp(ellipse(x, y, s, s * 0.7), 0.5, 0.9, a * 9), (px, py) => 3.6 + dome(x, y, s, s * 0.7, 1.6)(px, py, 0) + (vnoise(px * 2.5, py * 2.5, 4) - 0.5) * 0.6, moss);
    }
    for (const a of [-0.55, -0.15]) {
      const [x, y] = at(a, R1 - 0.6);
      r.part(box(x - 0.6, y - 0.4, 1.2, 2.6, 0.5), 4.6, matte2('#f2e8d2'));
      r.part(ellipse(x, y - 0.5, 2.2, 1.5), (px, py) => 5.4 + dome(x, y - 0.5, 2.2, 1.5, 1.4)(px, py, 0), enamel('#c8302c', { gloss: 0.6 }));
      for (const [dx, dy] of [[-0.9, -0.9], [0.6, -1.1], [0, -0.2]]) r.paint(circle(x + dx, y - 0.5 + dy, 0.3), matte2('#fff8ec'));
    }
    const [lx, ly] = at(2.1, R1 - 0.4);
    r.part(leaf(lx, ly, 5, 2.2, 2.1 + 1.2), 5.2, { ...cloth('felt', hex('#6cae3c'), { amt: 0.2 }), spec: 0.3, shin: 20 });
  },
  // cranberry wool knitted round a hoop, with a cable stitch
  knit: (r) => {
    const wool = cloth('felt', hex('#a82a3c'), { scale: 5, amt: 1.1 });
    r.part(band(), (x, y) => torusH(3.8)(x, y) + Math.sin(Math.atan2(y - C, x - C) * 36) * 0.18, wool);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, [x0, y0] = at(a, mid - 1.3), [x1, y1] = at(a + 0.13, mid), [x2, y2] = at(a, mid + 1.3);
      r.carve(segment(x0, y0, x1, y1, 0.26), 0.5, 0.3); r.carve(segment(x2, y2, x1, y1, 0.26), 0.5, 0.3);
    }
  },
  // curls of fine silver wire round a silver band, a pearl at each quarter
  filigree: (r) => {
    r.part(band(FRAME_OPEN - 0.4, FRAME_OPEN + 1.4), torusH(1.6, FRAME_OPEN + 0.5, 0.9, 1), silver());
    r.part(ring(C, C, R1 - 1.4, R1), torusH(1.4, R1 - 0.7, 0.7, 1), silver());
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (let t = 0; t < 1; t += 0.08) {
        const rr = FRAME_OPEN + 1.6 + t * 2.4, aa = a + Math.sin(t * Math.PI) * 0.32 * (i % 2 ? 1 : -1), [x, y] = at(aa, rr), [x2, y2] = at(a + Math.sin((t + 0.08) * Math.PI) * 0.32 * (i % 2 ? 1 : -1), FRAME_OPEN + 1.6 + (t + 0.08) * 2.4);
        r.part(segment(x, y, x2, y2, 0.32), 2, silver(0.9));
      }
    }
    for (let i = 0; i < 4; i++) { const [x, y] = at(-Math.PI / 2 + (i * Math.PI) / 2, mid); r.part(circle(x, y, 1.6), dome(x, y, 1.6, 1.6, 1.6, 2.4), { alb: (px, py) => mix(hex('#fdf8f0'), hex('#e6dcd8'), clamp(Math.hypot(px - x + 0.5, py - y + 0.5) / 2)) as RGB, spec: 1, shin: 60, coat: 0.8 }); }
  },
  // a fairy ring: a mossy turf ring with red toadstools growing round it
  mushroom: (r) => {
    const turf = cloth('felt', hex('#4e7a2a'), { scale: 6, amt: 1.2 });
    r.part(warp(band(), 0.3, 0.7, 5), (x, y) => torusH(2.6)(x, y) + (vnoise(x * 2, y * 2, 3) - 0.5) * 0.5, turf);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i / 7) * Math.PI * 2 + 0.2, [x, y] = at(a, mid + 0.3), s = i % 2 ? 2.1 : 2.6;
      r.part(box(x - 0.55, y - 0.2, 1.1, s, 0.5), 3.2, matte2('#f4ecd8'));
      r.part(ellipse(x, y - 0.4, s, s * 0.66), (px, py) => 4 + dome(x, y - 0.4, s, s * 0.66, 1.4)(px, py, 0), enamel('#cc322c', { gloss: 0.7 }));
      for (const [dx, dy] of [[-0.7, -0.7], [0.6, -0.9], [0.1, -0.1], [-1.1, 0]]) r.paint(circle(x + dx * s / 2.4, y - 0.4 + dy * s / 2.4, 0.28 * s / 2), matte2('#fff8ec'));
    }
  },
  // a wreath of gilded laurel leaves, tied with a red ribbon at the bottom
  laurel: (r) => {
    r.part(band(FRAME_OPEN - 0.4, FRAME_OPEN + 0.9), 1.4, gold(0.7));
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + side * (0.35 + i * 0.32), [x, y] = at(a, mid + (i % 2 ? 1.1 : -0.6));
      r.part(leaf(x, y, 4.6, 1.9, a + side * 1.15), (px, py) => 2.4 + i * 0.05 + dome(x, y, 2.3, 1, 1)(px, py, 0), gold(0.85));
      r.carve(rotate(box(x - 2, y - 0.08, 4, 0.16), a + side * 1.15, x, y), 0.4, 0.15);
    }
    const [bx, by] = at(Math.PI / 2, R1 - 0.6);
    r.part(union(polygon([[bx, by], [bx - 3.2, by - 1.6], [bx - 3.2, by + 1.6]]), polygon([[bx, by], [bx + 3.2, by - 1.6], [bx + 3.2, by + 1.6]])), 4.4, { ...cloth('velvet', hex('#b8343c'), { amt: 0.3 }), spec: 0.4, shin: 24 });
    r.part(circle(bx, by, 1), dome(bx, by, 1, 1, 0.8, 4.6), { ...cloth('velvet', hex('#9a2830'), { amt: 0.3 }), spec: 0.4, shin: 24 });
  },
  // ice: a glassy pale-blue ring with feathery crystals growing out of it
  frost: (r) => {
    const ice: Material = { ...glass(hex('#cfe8f6'), { metal: 0.25 }), alb: (x, y) => mix(hex('#d8eef9'), hex('#8cc0e0'), clamp(fbm(x * 0.4, y * 0.4, 4) * 1.2 - 0.2)) as RGB };
    r.part(band(FRAME_OPEN - 0.4, R1 - 1.2), torusH(3, mid - 0.6, half - 0.6), ice);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.1, L = i % 2 ? 2.4 : 3.6, [x0, y0] = at(a, R1 - 2.2), [x1, y1] = at(a, R1 - 2.2 + L);
      const w = 0.7, nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
      r.part(polygon([[x0 + nx, y0 + ny], [x1, y1], [x0 - nx, y0 - ny]]), 3.4, ice);
      if (i % 2 === 0) { const [mx, my] = at(a, R1 - 0.6); r.part(polygon([[mx, my], ...[[a + 0.25, R1 + 0.4], [a + 0.08, R1 - 0.2]].map(([aa, rr]) => at(aa, rr))]), 3.2, ice); }
    }
  },
  // a celestial orrery: a midnight enamel ring between gold rims, a brass sun and a silver moon on it, tiny stars
  celestial: (r) => {
    const sky: Material = { alb: (x, y) => mix(hex('#141c4c'), hex('#2a2a6a'), clamp(fbm(x * 0.3, y * 0.3, 2))) as RGB, spec: 0.7, shin: 50, coat: 0.9 };
    r.part(band(), torusH(2.8), sky);
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 0.9), torusH(1.2, FRAME_OPEN + 0.25, 0.65, 2.6), gold());
    r.part(ring(C, C, R1 - 1.1, R1), torusH(1.2, R1 - 0.55, 0.55, 2.6), gold());
    for (let i = 0; i < 9; i++) { const [x, y] = at(i * 0.7 + 0.3, mid + ((i * 37) % 3 - 1) * 0.7); r.paint(star(x, y, 0.55, 0.42), { alb: () => hex('#fff4c0'), emit: 1 }); }
    const [sx, sy] = at(-Math.PI * 0.72, mid);
    r.part(star(sx, sy, 3.4, 0.62, 0, 12), 3.6, gold(0.9));
    r.part(circle(sx, sy, 2), dome(sx, sy, 2, 2, 1.2, 4), gold(0.95));
    const [mx, my] = at(Math.PI * 0.28, mid);
    r.part(subtract(circle(mx, my, 2.6), circle(mx + 1.3, my - 0.8, 2.2)), (px, py) => 3.6 + dome(mx, my, 2.6, 2.6, 1)(px, py, 0), silver());
  },
  // gingerbread: a golden-brown biscuit ring piped with white icing and studded with gumdrops
  gingerbread: (r) => {
    const biscuit: Material = { ...paperMat('kraft', { tint: [236, 180, 120], scale: 4 }), alb: (x, y) => { const v = vnoise(x * 1.8, y * 1.8, 3); return mix(hex('#a8642c'), hex('#d49a58'), clamp(0.55 + (fbm(x * 0.5, y * 0.5, 4) - 0.5) * 0.8 - (v > 0.82 ? 0.3 : 0))) as RGB; }, spec: 0.15, shin: 10 };
    r.part(band(), (x, y) => torusH(3.2)(x, y) + (vnoise(x * 3, y * 3, 7) - 0.5) * 0.3, biscuit);
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, p = at(a, mid + (i % 2 ? 1.3 : -1.3)); if (prev) r.part(segment(prev[0], prev[1], p[0], p[1], 0.45), (x, y) => torusH(3.2)(x, y) + 0.8, { alb: () => hex('#fffaf2'), spec: 0.4, shin: 20 }); prev = p; }
    const gum = ['#e03a4a', '#3aa85a', '#f0c030', '#3a7ad8'];
    for (let i = 0; i < 6; i++) { const [x, y] = at(-Math.PI / 2 + (i / 6) * Math.PI * 2 + 0.26, R1 - 0.9); r.part(circle(x, y, 1.25), dome(x, y, 1.25, 1.25, 1.2, 3.6), { ...glass(hex(gum[i % 4]), { metal: 0.1 }), diffuse: 0.8 }); }
  },
  // a ring of deep night sky where little gold stars have come to rest, a fine brass rim each side
  starry: (r) => {
    const sky: Material = { alb: (x, y) => { const s = vnoise(x * 6, y * 6, 9); return (s > 0.93 ? hex('#ffffff') : mix(hex('#101a48'), hex('#3a2266'), clamp(fbm(x * 0.25, y * 0.25, 4) * 1.4 - 0.3))) as RGB; }, spec: 0.3, shin: 20, sheen: 0.3 };
    r.part(band(), torusH(3), sky);
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 0.6), 2.8, gold());
    r.part(ring(C, C, R1 - 0.8, R1), 2.6, gold());
    const stars: [number, number, number][] = [[-2.2, mid, 2.2], [-1.2, mid + 0.6, 1.4], [-0.4, mid - 0.4, 1.8], [0.6, mid + 0.3, 1.3], [1.4, mid, 2], [2.4, mid - 0.4, 1.4], [3.0, mid + 0.5, 1.7]];
    stars.forEach(([a, d, s], i) => { const [x, y] = at(a, d); r.part(star(x, y, s, 0.44, -Math.PI / 2 + i * 0.3), (px, py) => 3.2 + dome(x, y, s, s, 1.2)(px, py, 0), gold(0.9)); });
  },
};
function matte2(c: string): Material { return { alb: () => hex(c), spec: 0.1, shin: 8 }; }
void bevel; void box; void pillow; void rim; void enamel;

/** The frame ids that have art. */
export const FRAME_ART_IDS = Object.keys(PAINT);

/** A frame's art (a data URL) for showing at `px` CSS px across; the opening is clear. */
export function frameArt(id: string, px = 56): string {
  return cached(`frame7:${id}:${px}`, () => toURL(frameCanvas(id, px)));
}
const canvases = new Map<string, HTMLCanvasElement>();
function frameCanvas(id: string, px: number): HTMLCanvasElement {
  const key = id + ':' + px + ':' + deviceK();
  let c = canvases.get(key);
  if (!c) {
    const k = (px / FRAME_D) * deviceK(3);
    const r = new Real(FRAME_D, FRAME_D, k, 0);
    (PAINT[id] ?? PAINT.porthole)(r);
    r.cut(circle(C, C, FRAME_OPEN));
    c = r.canvas({ shadow: { dy: 0.8, blur: 1.2, a: 0.4 }, ambient: 0.5, aoR: 1.2 });
    canvases.set(key, c);
  }
  return c;
}

/** A frame with its little painted sky inside (no owl): for prize cards and lists, `px` CSS px across. */
export function frameWithSky(id: string, px = 64): string {
  return cached(`framesky7:${id}:${px}`, () => {
    const k = deviceK(3), c = document.createElement('canvas'), n = Math.round(px * k);
    c.width = c.height = n;
    const g = c.getContext('2d')!;
    const rr = (FRAME_OPEN / FRAME_D) * n + 1;
    g.save(); g.beginPath(); g.arc(n / 2, n / 2, rr, 0, Math.PI * 2); g.clip();
    g.drawImage(skyCanvas(frameSkyOf(id) === 'night', Math.round(rr * 2)), n / 2 - rr, n / 2 - rr, rr * 2, rr * 2);
    g.restore();
    g.drawImage(frameCanvas(id, px), 0, 0, n, n);
    return toURL(c);
  });
}

/** Which backdrop a frame's opening shows: the time of day's sky, or always the night (the starry frames). */
export const frameSkyOf = (id: string): 'auto' | 'night' => (id === 'starry' || id === 'celestial' ? 'night' : 'auto');

/** A painted sky for behind the owl, `n` px square: clear cerulean with soft clouds, or deep blue night with stars. */
export function portraitSky(night: boolean, n = 40): string {
  return cached(`psky7:${night}:${n}`, () => skyCanvas(night, n).toDataURL('image/png'));
}
const skies = new Map<string, HTMLCanvasElement>();
function skyCanvas(night: boolean, n: number): HTMLCanvasElement {
  const key = night + ':' + n;
  let c = skies.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, n);
  if (night) { gr.addColorStop(0, '#0c1436'); gr.addColorStop(0.6, '#1c2e64'); gr.addColorStop(1, '#3a5290'); }
  else { gr.addColorStop(0, '#4f9fd8'); gr.addColorStop(0.6, '#94cdee'); gr.addColorStop(1, '#dcf0fa'); }
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  if (night) {
    for (let i = 0; i < n / 3; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * n, y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * n * 0.7, s = 0.3 + ((i * 7) % 5) * 0.12; g.fillStyle = `rgba(255,250,230,${0.4 + ((i * 3) % 4) * 0.15})`; g.beginPath(); g.arc(x, y, s * n / 60, 0, Math.PI * 2); g.fill(); }
  } else {
    for (const [cx, cy, rr] of [[0.25, 0.62, 0.16], [0.4, 0.58, 0.2], [0.58, 0.64, 0.15], [0.8, 0.5, 0.12]]) {
      const cg = g.createRadialGradient(cx * n, cy * n, 0, cx * n, cy * n, rr * n);
      cg.addColorStop(0, 'rgba(255,255,255,.85)'); cg.addColorStop(0.6, 'rgba(255,255,255,.4)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(cx * n, cy * n, rr * n, 0, Math.PI * 2); g.fill();
    }
  }
  skies.set(key, c);
  return c;
}
