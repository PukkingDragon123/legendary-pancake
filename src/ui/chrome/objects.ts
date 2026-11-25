// [ui7] The HUD's and screens' physical objects, painted by the realistic material painter (src/ui/real/paint.ts)
// at device resolution: varnished walnut and oak sign boards with brass brackets, eye-hooks and screws, enamel
// medallions and push buttons in brass rims, engraved brass name plates, the walnut shelf, the felt-lined side
// tool tiles, a hemp rope and a brass chain (tiling), soft contact shadows, a bulldog clip and a clipboard clip,
// a damask wallpaper tile; the nightstand props (a beeswax candle in a brass chamberstick, a stoneware mug with
// steam, a phone), the burlap gift sack; and the 2D stand-ins of the three main objects (moon lamp, twin-bell
// alarm clock, leather journal) shown only when the live 3D shelf can't run.
//
// Sizes are CSS px; `zoom` is how much larger the HUD is drawn on big screens (1 phones, 1.5 desktops).
import {
  BRASS_OLD, COPPER, GOLD, IRON, Real, SILVER, bevel, box, cached, chamfer, circle, clamp, cloth, deviceK, dome, ellipse, enamel, fbm, glass, glow, hex,
  inter, leather, matte, metal, mix, paperMat, pillow, polygon, rim, ring, segment, smoothstep, subtract, toURL, tubeX, tubeY, union, vnoise, warp, wood,
  type Material, type RGB, type SDF, type WoodName,
} from '../real/paint.ts';

/** paint once per key (and device scale) */
export const cachedRelief = (key: string, make: () => string) => cached(key, make);

export type PalRamp = 'walnut' | 'oak' | 'cherry' | 'brass' | 'copper' | 'iron' | 'leather' | 'tan' | 'emerald' | 'moss' | 'sapphire' | 'sky' | 'rose' | 'plum' | 'linen' | 'paper' | 'enamel' | 'gold';
const HUES: Record<PalRamp, string> = {
  walnut: '#5a3418', oak: '#b07a3c', cherry: '#7a2e18', brass: '#c8962e', copper: '#c06a3a', iron: '#5a5e66', leather: '#7a2a24', tan: '#a8703a',
  emerald: '#2c6b43', moss: '#4f6e2a', sapphire: '#2b4b86', sky: '#3d8fc4', rose: '#a8404c', plum: '#5e2d6e', linen: '#d8c8a4', paper: '#efe2c4', enamel: '#efe8d8', gold: '#e0b04a',
};
export const hueRGB = (h: PalRamp): RGB => hex(HUES[h]);

/** device px per CSS px for a HUD part at `zoom` */
const kz = (zoom = 1) => Math.min(4, deviceK(3) * zoom);

/** brass screw head with a slot */
function screw(r: Real, x: number, y: number, rad = 1.8, ang = 0.6, z = 0) {
  r.part(circle(x, y, rad), dome(x, y, rad, rad, 1.3, z + 0.8), metal(BRASS_OLD, { polish: 0.5 }));
  const c = Math.cos(ang) * rad * 0.72, s = Math.sin(ang) * rad * 0.72;
  r.carve(segment(x - c, y - s, x + c, y + s, 0.3), 0.9, 0.3);
}

// ------------------------------------------------------------------ boards, plates, medallions

export type { WoodName };
export interface BoardOpts { wood?: WoodName; seed?: number; bevel?: number; hooks?: number[]; brackets?: boolean; screws?: [number, number][]; inset?: boolean; moss?: [number, number][]; chamfer?: number; radius?: number; gilt?: boolean }
/**
 * A varnished hardwood sign board, w x h CSS px: grain along its length, a rounded bevel catching the light,
 * a gilt bead inset from the edge, optional brass corner brackets, screws, brass eye-hooks for its ropes and
 * an inset panel. Painted with a 5 px shadow margin: show it at (w + 10) x (h + 10) with a -5 px offset, or
 * use `boardCSS` / `.hh-board` which already allow for it.
 */
export function board(w: number, h: number, zoom = 1, _res = 1, o: BoardOpts = {}): string {
  return cached(`board:${w}x${h}:${zoom}:${JSON.stringify(o)}`, () => {
    const m = 5, r = new Real(w, h, kz(zoom), m), bev = o.bevel ?? 5, R = o.radius ?? 8;
    const body = box(0, 2, w, h - 2, R);
    r.part(body, bevel(5, bev), wood(o.wood ?? 'walnut', { along: 'x', oy: (o.seed ?? 1) * 53, ox: (o.seed ?? 1) * 131 }));
    if (o.gilt !== false) {
      const g = subtract(box(bev - 0.2, bev + 1.8, w - 2 * bev + 0.4, h - 2 * bev - 1.6, Math.max(2, R - bev + 1)), box(bev + 1.2, bev + 3.2, w - 2 * bev - 2.4, h - 2 * bev - 4.4, Math.max(1.5, R - bev)));
      r.carve(g, 0.8, 0.5);
      r.paint(g, metal(GOLD, { polish: 0.75 }), 0.85);
    }
    if (o.inset) {
      const ins = box(bev + 3, bev + 5, w - 2 * bev - 6, h - 2 * bev - 8, 3);
      r.carve(ins, 1.8, 1.4);
    }
    if (o.brackets) for (const right of [false, true]) for (const top of [true, false]) {
      const X = (v: number) => (right ? w - v : v), Y = (v: number) => (top ? 2 + v : h - v);
      const L = Math.min(18, h * 0.42), B = 6;
      const sh = union(polygon([[X(-0.5), Y(-0.5)], [X(L), Y(-0.5)], [X(L), Y(B)], [X(B), Y(B)], [X(B), Y(L)], [X(-0.5), Y(L)]]), circle(X(L), Y(B / 2), B / 2), circle(X(B / 2), Y(L), B / 2));
      r.part(inter(sh, body), bevel(1.6, 1.4, 5.2), metal(BRASS_OLD, { polish: 0.55 }));
      screw(r, X(L - 1), Y(B / 2), 1.3, 0.5, 6.4);
    }
    for (const [x, y] of o.screws ?? []) screw(r, x, y, 1.8, x * 0.13, 5);
    for (const x of o.hooks ?? []) {
      r.part(ring(x, 1.2, 1.4, 3.4), (px, py) => 6.5 + 1.2 * Math.sqrt(Math.max(0, 1 - ((Math.hypot(px - x, py - 1.2) - 2.4) / 1) ** 2)), metal(GOLD, { polish: 0.7 }));
      r.part(circle(x, 5.4, 2.2), dome(x, 5.4, 2.2, 2.2, 1.4, 5.6), metal(BRASS_OLD, { polish: 0.6 }));
    }
    return r.url({ shadow: { dy: 3, blur: 4, a: 0.45 }, aoR: 3 });
  });
}
/** a board of any CSS size (for clipboards and panels) */
export const boardCSS = (wPx: number, hPx: number, o: BoardOpts = {}): string => board(wPx, hPx, 1, 1, o);

/** A round enamel medallion with a polished brass rim (the level badge), d CSS px (+4 px shadow margin). */
export function medallion(d: number, zoom = 1, _res = 1, hue: PalRamp = 'sapphire'): string {
  return cached(`medal:${d}:${zoom}:${hue}`, () => {
    const m = 4, r = new Real(d, d, kz(zoom), m), c = d / 2, col = hueRGB(hue);
    r.part(circle(c, c, c), rim(3.2, d * 0.15, 1.6), metal(GOLD, { polish: 0.8 }));
    const ri = c - d * 0.13;
    const guil = (x: number, y: number): RGB => {
      const a = Math.atan2(y - c, x - c), rr = Math.hypot(x - c, y - c);
      const cut = Math.sin(a * 18 + Math.sin(rr * 0.9) * 1.4) * 0.06;
      return mix(mix(col, [255, 255, 255], clamp(0.18 - rr / d * 0.4 + cut)), [10, 14, 40], clamp(rr / ri - 0.6) * 0.45);
    };
    r.part(circle(c, c, ri), dome(c, c, ri, ri, 2.4, 2.2), { alb: guil, spec: 0.6, shin: 50, coat: 1 });
    return r.url({ shadow: { dy: 2, blur: 3, a: 0.45 } });
  });
}

/** A round green-enamel push button with a brass rim and a raised cream plus (the currency "+"), d CSS px (+3 margin). */
export function plusButton(d: number, zoom = 1, _res = 1, down = false): string {
  return cached(`plus:${d}:${zoom}:${down}`, () => {
    const m = 3, r = new Real(d, d, kz(zoom), m), c = d / 2;
    r.part(circle(c, c, c - 0.2), rim(2.4, 3.4, 1), metal(GOLD, { polish: 0.75 }));
    const ri = c - 3;
    r.part(circle(c, c + (down ? 0.6 : 0), ri), dome(c, c, ri, ri, down ? 1.2 : 2.8, 1.8), enamel(hex('#2f8a52')));
    const t = d * 0.09, L = d * 0.27, oy = down ? 0.6 : 0;
    const pl = union(box(c - L, c - t + oy, 2 * L, 2 * t, t), box(c - t, c - L + oy, 2 * t, 2 * L, t));
    r.part(pl, (x, y, ins) => (down ? 3.2 : 4.8) + Math.min(0.9, ins * 0.8), enamel(hex('#fff4d6')));
    return r.url({ shadow: { dy: down ? 0.6 : 1.6, blur: down ? 1 : 2.4, a: 0.45 } });
  });
}

/** A small engraved brass name plate with two screws, w x h CSS px (+3 margin). */
export function plate(w: number, h: number, zoom = 1, _res = 1): string {
  return cached(`plate:${w}x${h}:${zoom}`, () => {
    const m = 3, r = new Real(w, h, kz(zoom), m);
    r.part(box(0, 0, w, h, 3), bevel(2.4, 2), metal(GOLD, { along: 'x', polish: 0.6 }));
    r.carve(subtract(box(3, 3, w - 6, h - 6, 2), box(3.8, 3.8, w - 7.6, h - 7.6, 1.6)), 0.5, 0.4);
    screw(r, 5.5, h / 2, 1.6, 0.3, 1.6); screw(r, w - 5.5, h / 2, 1.6, 1.1, 1.6);
    return r.url({ shadow: { dy: 1.5, blur: 2, a: 0.45 } });
  });
}

/** The walnut shelf the three big objects stand on: a thick moulded board with brass brackets, w x 32 CSS px (+4 margin). */
export function shelfBoard(w: number, zoom = 1, _res = 1): string {
  return cached(`shelf:${w}:${zoom}`, () => {
    const m = 4, h = 32, r = new Real(w, h, kz(zoom), m);
    r.part(box(2, 0, w - 4, 9, 2), chamfer(2, 3, 4), wood('walnut', { along: 'x', oy: 30 }));
    r.part(box(0, 8, w, 14, 4), bevel(5, 3.5, 2), wood('walnut', { along: 'x', oy: 110 }));
    r.carve(box(4, 13.2, w - 8, 1.2, 0.6), 1, 0.6);
    for (const bx of [30, w - 42]) {
      r.part(polygon([[bx, 21], [bx + 12, 21], [bx + 12, 23], [bx + 4, 31], [bx, 31]]), bevel(1.5, 1.2, 3), metal(BRASS_OLD, { polish: 0.5 }));
      screw(r, bx + 6, 17, 1.6, 0.4, 5);
    }
    return r.url({ shadow: { dy: 4, blur: 6, a: 0.5 } });
  });
}

/** A side-tool tile: a hardwood frame with brass corner studs round a coloured felt inset, a brass ring on top; s x (s+8) CSS px (+4 margin). */
export function toolTile(s: number, hue: PalRamp, zoom = 1, _res = 1, seed = 1): string {
  return cached(`tool:${s}:${hue}:${zoom}:${seed}`, () => {
    const m = 4, h = s + 8, r = new Real(s, h, kz(zoom), m);
    r.part(ring(s / 2, 4, 1.9, 4.4), (x, y) => 4 + 1.6 * Math.sqrt(Math.max(0, 1 - ((Math.hypot(x - s / 2, y - 4) - 3.15) / 1.25) ** 2)), metal(GOLD, { polish: 0.7 }));
    const fr = box(0, 8, s, s, 6);
    r.part(fr, bevel(5, 3.4), wood('walnut', { along: seed % 2 ? 'x' : 'y', ox: seed * 77, oy: seed * 41 }));
    const ins = box(5, 13, s - 10, s - 10, 3.5);
    r.part(ins, (x, y, i) => 1.4 + Math.min(1.2, i * 0.35), cloth('felt', hueRGB(hue), { scale: 2.6, amt: 0.8 }));
    for (const [x, y] of [[4.4, 12.4], [s - 4.4, 12.4], [4.4, s + 3.6], [s - 4.4, s + 3.6]]) r.part(circle(x, y, 2.1), dome(x, y, 2.1, 2.1, 1.5, 4.8), metal(GOLD, { polish: 0.7 }));
    return r.url({ shadow: { dy: 3, blur: 4, a: 0.45 }, aoR: 3 });
  });
}

/** The brass bulldog clip that holds the bedtime card, 44 x 26 CSS px (+3 margin). */
export function clip(zoom = 1, _res = 1): string {
  return cached(`clip:${zoom}`, () => {
    const w = 44, h = 26, m = 3, r = new Real(w, h, kz(zoom), m);
    r.part(ring(w / 2, 6.4, 3.6, 6.4), (x, y) => 3 + 1.4 * Math.sqrt(Math.max(0, 1 - ((Math.hypot(x - w / 2, y - 6.4) - 5) / 1.4) ** 2)), metal(SILVER, { polish: 0.7 }));
    r.part(box(2, 9, w - 4, 16, 3), (x, y) => 3 + (y - 9) * 0.22 + 1.6 * Math.sin(clamp((x - 2) / (w - 4)) * Math.PI), metal(GOLD, { along: 'x', polish: 0.7 }));
    r.carve(box(5, 19, w - 10, 1.2, 0.6), 0.8, 0.5);
    return r.url({ shadow: { dy: 2, blur: 2.5, a: 0.45 } });
  });
}

/** A big nickel-and-brass clipboard clip: a pressed plate, a rolled lever and two rivets, w x (w/3) CSS px (+3 margin). */
export function clipboardClip(w = 120, zoom = 1, _res = 1): string {
  return cached(`cbclip:${w}:${zoom}`, () => {
    const h = w / 3, m = 3, r = new Real(w, h, kz(zoom), m), cx = w / 2, u = w / 60;
    r.part(subtract(ring(cx, 5 * u, 4.2 * u, 6.4 * u), box(cx - 8 * u, 5.4 * u, 16 * u, 4 * u)), (x, y) => 4 + 1.8 * u * Math.sqrt(Math.max(0, 1 - ((Math.hypot(x - cx, y - 5 * u) - 5.3 * u) / (1.1 * u)) ** 2)), metal(SILVER, { polish: 0.8 }));
    r.part(polygon([[6 * u, 8 * u], [w - 6 * u, 8 * u], [w - 1 * u, h - 1], [1 * u, h - 1]]), (x, y) => 3 + (y - 8 * u) * 0.2 + 2.4 * Math.sin(clamp((x - u) / (w - 2 * u)) * Math.PI), metal(GOLD, { along: 'x', polish: 0.65 }));
    r.part(box(4 * u, 15 * u, w - 8 * u, 3 * u, 1.5 * u), tubeX(16.5 * u, 1.5 * u, 6), metal(GOLD, { along: 'x', polish: 0.8 }));
    for (const x of [10 * u, w - 10 * u]) r.part(circle(x, 11.4 * u, 1.6 * u), dome(x, 11.4 * u, 1.6 * u, 1.6 * u, 1.4, 6), metal(SILVER, { polish: 0.7 }));
    return r.url({ shadow: { dy: 2.5, blur: 3, a: 0.45 } });
  });
}

/** A tile of printed damask wallpaper (u CSS px square, tiles): a deep ground, a lighter leafy motif, paper grain. */
export function wallpaperTile(hue: PalRamp = 'emerald', u = 64, _k = 2): string {
  return cached(`wall:${hue}:${u}`, () => {
    const k = deviceK(2), r = new Real(u, u, k, 0), base = hueRGB(hue), lite = mix(base, [240, 220, 170], 0.32), gild = mix(hex('#d9a84a'), base, 0.25);
    const c = u / 2;
    r.part(box(-1, -1, u + 2, u + 2), 0, paperMat('paper', { tint: [base[0] * 1.35, base[1] * 1.35, base[2] * 1.35] as RGB, scale: 1.4 }));
    // a damask medallion in the middle, half medallions on the edges (so it tiles)
    const motif = (cx: number, cy: number): SDF => {
      const s = u * 0.22;
      return union(ellipse(cx, cy, s * 0.55, s), ellipse(cx, cy - s * 0.95, s * 0.28, s * 0.45), ellipse(cx, cy + s * 0.95, s * 0.28, s * 0.45), ellipse(cx - s * 0.75, cy, s * 0.45, s * 0.24), ellipse(cx + s * 0.75, cy, s * 0.45, s * 0.24));
    };
    for (const [x, y] of [[c, c], [0, 0], [u, 0], [0, u], [u, u]]) r.part(motif(x, y), 0.6, paperMat('paper', { tint: lite, scale: 1.4 }));
    for (const [x, y] of [[c, c], [0, 0], [u, 0], [0, u], [u, u]]) r.paint(ring(x, y, u * 0.06, u * 0.085), { ...metal(gild, { polish: 0.5 }) }, 0.8);
    return r.url({ shadow: false, ambient: 0.55 });
  });
}

// ------------------------------------------------------------------ ropes, chains, shadows

/** A twisted hemp rope tile, 6 x 8 CSS px, tiling vertically: three strands spiralling, lit from the left. */
export function hempRope(): string {
  return cached('rope2', () => {
    const W = 6, H = 8, k = deviceK(4), r = new Real(W, H, k, 0);
    const col: RGB = hex('#c9a46a');
    r.part(box(0.2, -1, W - 0.4, H + 2, 0), tubeY(W / 2, 2.9, 0), cloth('linen', col, { scale: 3, amt: 0.9 }));
    // the strands: diagonal grooves, periodic in y
    for (let i = -1; i < 3; i++) {
      const y0 = i * (H / 2);
      r.carve(segment(-0.5, y0 + 4.2, W + 0.5, y0, 0.32), 1.1, 0.6);
    }
    return r.url({ shadow: false, ambient: 0.5 });
  });
}

/** A brass chain tile, 8 x 12 CSS px: one link face on, one edge on, lit from the top left. */
export function brassChain(): string {
  return cached('chain2', () => {
    const W = 8, H = 12, k = deviceK(4), r = new Real(W, H, k, 0);
    const mat = metal(GOLD, { polish: 0.8 });
    // a face-on oval link (from y -1 to 7) and an edge-on one (6 .. 13) wrapping round
    r.part(subtract(ellipse(4, 3, 3.2, 4.4), ellipse(4, 3, 1.5, 2.7)), (x, y) => 1 + 1.2 * Math.sqrt(Math.max(0, 1 - ((Math.hypot((x - 4) / 3.2, (y - 3) / 4.4) - 0.68) / 0.32) ** 2)), mat);
    r.part(box(2.9, 6, 2.2, 7.5, 1.1), tubeY(4, 1.1, 1.6), mat);
    r.part(box(2.9, -1.5, 2.2, 1.6, 1.1), tubeY(4, 1.1, 1.6), mat);
    return r.url({ shadow: false });
  });
}

/** A soft contact shadow (an ellipse that darkens toward its middle), w x h CSS px. */
export function contactShadow(w: number, h: number, _zoom = 1): string {
  return cached(`cshadow:${w}x${h}`, () => {
    const k = deviceK(2), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d')!;
    g.scale(k, k); g.translate(w / 2, h / 2); g.scale(1, h / w);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    gr.addColorStop(0, 'rgba(24,14,8,.6)'); gr.addColorStop(0.55, 'rgba(24,14,8,.32)'); gr.addColorStop(1, 'rgba(24,14,8,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill();
    return c.toDataURL('image/png');
  });
}

export type ToolIcon = 'build' | 'shop' | 'wardrobe' | 'quests' | 'map' | 'settings';
/** The side tools' icons come from the 3D icon family (iconset.ts); there is no painted fallback any more. */
export const toolIcon = (_id: ToolIcon, _k = 2, _res = 1): string => '';

// ------------------------------------------------------------------ nightstand props (sleep screen)

/**
 * A beeswax pillar candle in a brass chamberstick with a finger ring, the flame flickering (frame `f` 0..3);
 * 54 x 108 CSS px.
 */
export function propCandle(f = 0, _k = 3): string {
  return cached(`candle2:${f}`, () => {
    const W = 54, H = 108, r = new Real(W, H, deviceK(3), 0), cx = 27;
    const brass = metal(GOLD, { polish: 0.75 });
    // the dish and its ring handle
    r.part(ellipse(cx, 96, 25, 8), (x, y) => 2 + dome(cx, 96, 25, 8, 4)(x, y, 0), brass);
    r.part(subtract(ellipse(cx + 22, 90, 6, 6), ellipse(cx + 22, 90, 3.4, 3.4)), 4.5, brass);
    r.part(ellipse(cx, 92, 11, 4), 6.5, brass);
    // the candle: a creamy beeswax pillar with a melted lip and drips
    const wax: Material = { alb: (x, y) => mix(hex('#f6e6bc'), hex('#e8c888'), clamp((y - 40) / 60) * 0.5 + (vnoise(x * 0.5, y * 0.2, 5) - 0.5) * 0.08), spec: 0.25, shin: 18, diffuse: 0.85 };
    const body = union(box(cx - 9, 40, 18, 52, 3), segment(cx - 7, 44, cx - 7, 54, 1.6), segment(cx + 5, 43, cx + 5, 60, 1.4));
    r.part(body, (x) => tubeY(cx, 9.5, 6)(x, 0, 0), wax);
    r.part(ellipse(cx, 41, 9, 2.6), (x, y) => 14 - dome(cx, 41, 9, 2.6, 1.4)(x, y, 0), wax);
    r.part(segment(cx, 33, cx + 0.4, 40, 0.7), 16, matte('#2a1a10'));
    const c = r.canvas({ shadow: { dy: 2, blur: 3, a: 0.35 } });
    // the flame (painted smooth, flickering), with a halo
    const g = c.getContext('2d')!, k = deviceK(3);
    g.save(); g.scale(k, k);
    const fl = [0, 0.8, -0.6, 0.3][f % 4], hgt = [15, 16.5, 14, 15.5][f % 4];
    const halo = g.createRadialGradient(cx, 26, 0, cx, 26, 26);
    halo.addColorStop(0, 'rgba(255,214,130,.45)'); halo.addColorStop(1, 'rgba(255,190,90,0)');
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = halo; g.beginPath(); g.arc(cx, 26, 26, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    const fg = g.createLinearGradient(0, 33 - hgt, 0, 34);
    fg.addColorStop(0, 'rgba(255,246,210,0)'); fg.addColorStop(0.25, '#fff4c4'); fg.addColorStop(0.65, '#ffc24a'); fg.addColorStop(0.92, '#e8762a'); fg.addColorStop(1, 'rgba(70,90,200,.7)');
    g.fillStyle = fg;
    g.beginPath(); g.moveTo(cx + fl, 33 - hgt); g.bezierCurveTo(cx + 5 + fl * 0.5, 28 - hgt * 0.4, cx + 4.2, 33, cx, 34); g.bezierCurveTo(cx - 4.2, 33, cx - 5 + fl * 0.5, 28 - hgt * 0.4, cx + fl, 33 - hgt); g.fill();
    const core = g.createRadialGradient(cx, 30, 0, cx, 30, 3);
    core.addColorStop(0, 'rgba(255,255,240,.95)'); core.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = core; g.beginPath(); g.arc(cx, 30, 3, 0, Math.PI * 2); g.fill();
    g.restore();
    return toURL(c);
  });
}

/** A hand-thrown stoneware mug (chamomile or coffee inside), 78 x 78 CSS px. */
export function propMug(kind: 'tea' | 'coffee', _k = 3): string {
  return cached(`mug2:${kind}`, () => {
    const W = 78, H = 78, r = new Real(W, H, deviceK(3), 0), cx = 34;
    const glaze: Material = {
      alb: (x, y) => {
        const run = fbm(x * 0.12, y * 0.05, 3, 3);
        const top = mix(hex('#3f6f8c'), hex('#6f9cb2'), clamp(run * 1.4 - 0.2));
        const clay = mix(hex('#b9875a'), hex('#d4a476'), vnoise(x * 0.6, y * 0.6, 4));
        const edge = 58 + Math.sin(x * 0.35) * 3 + run * 4;
        const c = y > edge ? clay : top;
        return (vnoise(x * 2.1, y * 2.1, 9) > 0.86 ? mix(c, [30, 26, 22], 0.35) : c) as RGB;
      },
      spec: 0.7, shin: 40, coat: 0.7,
    };
    // handle
    r.part(subtract(ellipse(cx + 26, 40, 11, 13), ellipse(cx + 26, 40, 5.5, 7.5)), (x, y) => 6 + 3 * Math.sqrt(Math.max(0, 1 - ((Math.hypot((x - cx - 26) / 11, (y - 40) / 13) - 0.78) / 0.22) ** 2)), glaze);
    // body (slightly barrel-shaped, rippled)
    const bodyS = polygon([[cx - 24, 22], [cx + 24, 22], [cx + 25.5, 44], [cx + 23, 68], [cx - 23, 68], [cx - 25.5, 44]]);
    r.part(bodyS, (x, y) => tubeY(cx, 26, 4)(x, y, 0) + Math.sin(y * 0.55) * 0.35, glaze);
    // the foot shadow line and the rim with the drink
    r.part(ellipse(cx, 22, 24, 6), 30, glaze);
    r.part(ellipse(cx, 22.6, 20.5, 4.6), 29, kind === 'tea' ? { alb: () => hex('#d9a441'), spec: 0.9, shin: 80, coat: 1 } : { alb: () => hex('#4a2a16'), spec: 0.9, shin: 80, coat: 1 });
    return r.url({ shadow: { dy: 2, blur: 3, a: 0.35 } });
  });
}

/** Steam rising from the mug: soft wisps, frame `f` (0..3), 78 x 42 CSS px, transparent. */
export function mugSteam(f = 0, _k = 3): string {
  return cached(`steam2:${f}`, () => {
    const W = 78, H = 42, k = deviceK(2), c = document.createElement('canvas');
    c.width = W * k; c.height = H * k;
    const g = c.getContext('2d')!;
    g.scale(k, k); g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x0 = 24 + i * 10, ph = f * 0.9 + i * 1.7;
      g.strokeStyle = `rgba(255,252,244,${0.38 - i * 0.06})`; g.lineWidth = 3.2 - i * 0.5;
      g.filter = 'blur(0.6px)';
      g.beginPath();
      for (let y = H; y >= 4; y -= 2) { const x = x0 + Math.sin(y * 0.18 + ph) * (3 + (H - y) * 0.08); if (y === H) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    return c.toDataURL('image/png');
  });
}

/**
 * The phone on the nightstand: lying face up, dark glass with a soft glint, or (`bed`) in its cosy wool sleeve
 * showing the bedtime lock; 66 x 102 CSS px.
 */
export function propPhone(bed: boolean, _k = 3): string {
  return cached(`phone2:${bed}`, () => {
    const W = 66, H = 102, r = new Real(W, H, deviceK(3), 0);
    r.part(box(6, 4, 54, 94, 10), bevel(3, 2.5), metal(hex('#3a3c44'), { polish: 0.6 }));
    const scr = box(9, 7, 48, 88, 8);
    const sky = (x: number, y: number): RGB => bed ? mix(hex('#1c2a52'), hex('#4a3a6e'), clamp(y / 90)) as RGB : mix(hex('#0e1016'), hex('#1a1d26'), clamp(y / 90)) as RGB;
    r.part(scr, 3.2, { ...glass(hex('#111')), alb: sky, metal: 0.2 });
    if (bed) {
      r.paint(circle(33, 30, 7), glow((x, y) => mix(hex('#fff4d0'), hex('#f4d488'), clamp(Math.hypot(x - 33, y - 30) / 7)) as RGB));
      r.paint(circle(36.5, 27.5, 6.2), { alb: sky, spec: 0.8, shin: 60 });
      r.paint(box(20, 56, 26, 3, 1.5), glow('#e8dcc0'), 0.85);
      r.paint(box(24, 63, 18, 2.2, 1.1), glow('#b8b0c8'), 0.7);
    }
    r.part(box(28, 9, 10, 2.4, 1.2), 3.6, matte('#050608'));
    const c = r.canvas({ shadow: { dy: 2.5, blur: 4, a: 0.4 } });
    const g = c.getContext('2d')!, k = deviceK(3);
    g.save(); g.scale(k, k);
    const gl = g.createLinearGradient(9, 7, 57, 60);
    gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(0.4, 'rgba(255,255,255,.05)'); gl.addColorStop(0.41, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.beginPath(); g.roundRect(9, 7, 48, 88, 8); g.fill();
    g.restore();
    return toURL(c);
  });
}

/** The burlap gift sack Pip brings home, tied with a red ribbon; `open` 0..1 loosens the neck. 224 x 232 CSS px. */
export function giftSack(open = 0, _k = 2): string {
  return cached(`sack2:${open}`, () => {
    const W = 224, H = 232, r = new Real(W, H, deviceK(2), 0), cx = 112;
    const burlap = cloth('linen', hex('#b48a52'), { scale: 1.3, amt: 1.1 });
    const neckW = 26 + open * 30, top = 30 - open * 6;
    const bodyS = warp(union(ellipse(cx, 158, 92, 70), polygon([[cx - 60, 110], [cx + 60, 110], [cx + neckW, 70], [cx - neckW, 70]])), 3, 0.05, 4);
    r.part(bodyS, (x, y, ins) => 8 + Math.min(26, ins * 0.6) + Math.sin(x * 0.12 + y * 0.03) * 1.2, burlap);
    // the gathered neck and the ruffled top
    r.part(warp(polygon([[cx - neckW - 18, top + 6], [cx + neckW + 18, top + 4], [cx + neckW + 4, 72], [cx - neckW - 4, 72]]), 3, 0.12, 6), (x, y, ins) => 22 + Math.min(8, ins * 0.4) + Math.sin(x * 0.5) * 1.6, burlap);
    if (open > 0.3) r.part(ellipse(cx, top + 8, neckW + 10, 8 + open * 4), 30, matte('#2a1a0e'));
    // the ribbon round the neck with a bow
    const red: Material = { ...cloth('velvet', hex('#b8343c'), { amt: 0.3 }), spec: 0.45, shin: 28, sheen: 0.45 };
    r.part(box(cx - neckW - 6, 64, neckW * 2 + 12, 11, 5), (x, y) => 34 + tubeX(69.5, 5.5)(x, y, 0) * 0.6, red);
    if (open < 0.6) {
      r.part(ellipse(cx - 16, 66, 15, 9), (x, y) => 38 + dome(cx - 16, 66, 15, 9, 5)(x, y, 0), red);
      r.part(ellipse(cx + 16, 66, 15, 9), (x, y) => 38 + dome(cx + 16, 66, 15, 9, 5)(x, y, 0), red);
      r.part(polygon([[cx - 6, 70], [cx - 2, 70], [cx - 14, 100], [cx - 22, 96]]), 36, red);
      r.part(polygon([[cx + 2, 70], [cx + 6, 70], [cx + 22, 96], [cx + 14, 100]]), 36, red);
      r.part(circle(cx, 68, 6), dome(cx, 68, 6, 6, 4, 40), red);
    }
    void COPPER; void IRON; void leather; void pillow; void glass;
    return r.url({ shadow: { dy: 6, blur: 10, a: 0.4 }, aoR: 8 });
  });
}

// ------------------------------------------------------------------ the main objects' 2D stand-ins

/** Moon lamp: a brass stand holding a glowing glass moon. 52 x 54 units (k device px per unit). */
export function moonLamp(k = 2, _res = 1, glowK = 0.6, lit = 1): string {
  return cached(`moonlamp2:${k}:${glowK.toFixed(2)}:${lit}`, () => {
    const r = new Real(52, 54, k * deviceK(3), 0), brass = metal(GOLD, { polish: 0.75 });
    r.part(ellipse(26, 49, 15, 4), (x, y) => 1 + dome(26, 49, 15, 4, 2.4)(x, y, 0), brass);
    r.part(box(23.5, 34, 5, 15, 2), tubeY(26, 2.5, 3), brass);
    const moon = (x: number, y: number): RGB => {
      const crater = fbm(x * 0.18, y * 0.18, 8, 3);
      return mix(hex('#c9d4ea'), hex('#fff8dc'), clamp(0.45 + glowK * 0.5 + (crater - 0.5) * 0.4)) as RGB;
    };
    r.part(circle(26, 20, 15), dome(26, 20, 15, 15, 12, 4), lit ? { alb: moon, emit: 0.0, spec: 0.8, shin: 60, coat: 1, diffuse: 0.35 } : { alb: (x, y) => mix(moon(x, y), [70, 80, 110], 0.5) as RGB, spec: 0.8, shin: 60, coat: 1 });
    return r.url({ shadow: { dy: 1.5, blur: 2, a: 0.35 }, ambient: lit ? 0.75 : 0.4 });
  });
}
/** The halo of moonlight behind the lamp: a soft radial glow (52 x 54 units). */
export function lampHalo(k = 2, _res = 1, strength = 1): string {
  return cached(`halo2:${k}:${strength}`, () => {
    const kk = k * deviceK(2), c = document.createElement('canvas');
    c.width = Math.round(52 * kk); c.height = Math.round(54 * kk);
    const g = c.getContext('2d')!;
    g.scale(kk, kk);
    const gr = g.createRadialGradient(26, 20, 4, 26, 20, 26);
    gr.addColorStop(0, `rgba(220,232,255,${0.7 * strength})`); gr.addColorStop(0.45, `rgba(190,210,250,${0.3 * strength})`); gr.addColorStop(1, 'rgba(180,200,250,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 52, 54);
    return c.toDataURL('image/png');
  });
}

/** Geometry of the twin-bell alarm clock, in units. */
export const ALARM = { W: 52, H: 54, cx: 26, cy: 30, dial: 12.6 };
/**
 * A brass twin-bell alarm clock with a cream enamel dial (numerals, minute ticks), units per ALARM; `k` device px
 * per unit. `ringF` 1/2 tilts the bells (ringing frames).
 */
export function alarmClock(k = 2, _res = 1, ringF = 0): string {
  return cached(`alarm2:${k}:${ringF}`, () => {
    const { W, H, cx, cy, dial } = ALARM, r = new Real(W, H, k, 0), brass = metal(GOLD, { polish: 0.8 });
    const tilt = ringF === 1 ? -1.2 : ringF === 2 ? 1.2 : 0;
    // feet and hammer
    r.part(segment(cx - 9, cy + 13, cx - 13, cy + 20, 1.6), 3, brass);
    r.part(segment(cx + 9, cy + 13, cx + 13, cy + 20, 1.6), 3, brass);
    r.part(segment(cx, cy - 15, cx + tilt * 2, cy - 19.5, 0.9), 6, brass);
    // bells
    for (const s of [-1, 1]) {
      const bx = cx + s * 11 + tilt, by = cy - 14;
      r.part(ellipse(bx, by, 8.5, 6.4), dome(bx, by + 1, 8.5, 7, 6, 2), brass);
      r.part(circle(bx, by - 6, 1.4), dome(bx, by - 6, 1.4, 1.4, 1, 7), brass);
    }
    // body and bezel
    r.part(circle(cx, cy, dial + 4), rim(4, 5, 4), brass);
    r.part(circle(cx, cy, dial + 0.4), (x, y) => 7 - dome(cx, cy, dial, dial, 0.8)(x, y, 0) * 0.2, { alb: (x, y) => mix(hex('#fbf3df'), hex('#ead9b4'), clamp(Math.hypot(x - cx + 3, y - cy + 3) / (dial * 1.6))) as RGB, spec: 0.3, shin: 30 });
    // minute ticks and hour marks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, big = i % 5 === 0, r0 = dial - (big ? 2.6 : 1.4), r1 = dial - 0.7;
      r.paint(segment(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0, cx + Math.sin(a) * r1, cy - Math.cos(a) * r1, big ? 0.42 : 0.16), matte('#2a1e14'));
    }
    return r.url({ shadow: { dy: 1.5, blur: 2, a: 0.35 } });
  });
}
/** Draw the alarm clock's hands (blued hour and minute, a red seconds hand, the gold alarm hand) and the glass glint. */
export function alarmHands(g: CanvasRenderingContext2D, k: number, _res: number, d: Date, wake?: number) {
  const { cx, cy, dial } = ALARM;
  g.save();
  g.scale(k, k);
  g.lineCap = 'round';
  const hand = (ang: number, len: number, w: number, col: string, tail = 2) => {
    g.strokeStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(cx - Math.sin(ang) * tail, cy + Math.cos(ang) * tail); g.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); g.stroke();
  };
  g.shadowColor = 'rgba(20,10,4,.35)'; g.shadowBlur = 0.8 * k; g.shadowOffsetY = 0.5 * k;
  const h = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
  if (wake !== undefined) hand(((wake % 720) / 720) * Math.PI * 2, dial - 3.4, 1.0, '#d9a32c', 0);
  hand(((h * 60 + m) / 720) * Math.PI * 2, dial * 0.52, 1.5, '#1d2a4a');
  hand(((m * 60 + s) / 3600) * Math.PI * 2, dial * 0.8, 1.1, '#1d2a4a');
  hand((s / 60) * Math.PI * 2, dial * 0.86, 0.45, '#b8322e', 3);
  g.shadowColor = 'transparent';
  g.fillStyle = '#c8962e'; g.beginPath(); g.arc(cx, cy, 1.2, 0, Math.PI * 2); g.fill();
  const gl = g.createLinearGradient(cx - dial, cy - dial, cx + dial * 0.2, cy + dial * 0.2);
  gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(0.5, 'rgba(255,255,255,.06)'); gl.addColorStop(0.51, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, dial, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** The leather journal: oxblood leather over boards, gilt crescent, page block; `open` 0..1 swings the cover. 52 x 54 units. */
export function journal(k = 2, _res = 1, open = 0): string {
  return cached(`journal2:${k}:${open}`, () => {
    const r = new Real(52, 54, k * deviceK(3), 0);
    const pages: Material = { alb: (_x, y) => mix(hex('#f6ecd2'), hex('#dcc9a0'), (Math.sin(y * 3.1) + 1) * 0.15) as RGB, spec: 0.05 };
    r.part(box(10, 6, 34, 44, 2), 3, pages);
    const cw = 34 * (1 - open * 0.85);
    const cover = box(8, 4, Math.max(6, cw + 2), 46, 3);
    r.part(cover, bevel(3, 3, 3), leather('#7a1f24', { scale: 3 }));
    r.part(box(6, 4, 6, 46, 3), (x, y) => 4 + tubeY(9, 3)(x, y, 0) * 0.5, leather('#6a1a1e', { scale: 3 }));
    if (open < 0.5) {
      const cxm = 8 + cw / 2 + 1;
      r.paint(subtract(circle(cxm, 24, 7), circle(cxm + 3.5, 22, 6.4)), metal(GOLD, { polish: 0.8 }));
      r.carve(subtract(box(11, 7, cw - 4, 40, 2), box(12, 8, cw - 6, 38, 1.6)), 0.4, 0.3);
    }
    return r.url({ shadow: { dy: 1.5, blur: 2, a: 0.35 } });
  });
}

/** Detail level for a HUD part: the HUD is drawn 1.5x on big screens. */
export const DESK_HUD = '(min-width: 900px) and (min-height: 640px)';
export const DESK_NAV = '(min-width: 900px) and (min-height: 760px)';
/** [ui7] the HUD zoom for a media query: 1.5 where the HUD is shown 1.5x (desktop), else 1 */
export const kFor = (q: string) => { try { return matchMedia(q).matches ? 1.5 : 1; } catch { return 1; } };

export { hex, smoothstep };
