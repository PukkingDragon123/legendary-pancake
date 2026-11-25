// The realistic UI kit: 9-slice frames (shown with border-image, so they fit any size without repainting)
// painted by the material painter (paint.ts) at device resolution, plus the CSS that shows them.
//
//   NINE[name]()          paint (once, cached) and describe a frame
//   nineCSS(name, o)      CSS declarations that dress an element in it (border-image, widths, outset)
//   frameStyle(name)      drop-in for the old pixel frames' frameStyle(): same names, realistic art
//
// Frames: carved walnut / oak / ebony panel frames with brass corner brackets and a gilt bead; enamel
// buttons with brass rims (emerald, honey brass, berry, sapphire, ivory linen, oak, disabled) and their
// pressed states; leather tabs; brass-rimmed linen trays (item slots) incl. the gold "chosen" and the iron
// "locked"; a walnut chip; glass bar tubes and liquid fills; satin ribbons with notched tails; a paper speech
// bubble; a sticky note; an inset field; a brass plaque; a tooltip.
import {
  BRASS_OLD, GOLD, IRON, Real, bevel, box, cached, circle, clamp, cloth, deviceK, enamel, glow, hex, leather, matte, metal, mix, paperMat, pillow, polygon,
  inter, rim, segment, toURL, subtract, union, wood, moulding, torn, type Material, type RGB, type WoodName,
} from './paint.ts';
import { texReady } from './tex.ts';

export interface Nine {
  url: string;
  /** slices (units = CSS px): top right bottom left */
  s: [number, number, number, number];
  /** how far the art spills outside the box (shadows) */
  o: number;
  /** the element's own border widths (layout) */
  bw: [number, number, number, number];
  fill: boolean;
  rep?: string;
  /** device px per unit it was painted at */
  k: number;
}

// ------------------------------------------------------------------ shared parts

/** a slotted brass screw head */
export function screw(r: Real, x: number, y: number, rad = 1.7, ang = 0.6, z = 0) {
  r.part(circle(x, y, rad), (px, py) => z + 1.2 + 1.1 * Math.sqrt(Math.max(0, 1 - ((px - x) ** 2 + (py - y) ** 2) / (rad * rad))), metal(BRASS_OLD, { polish: 0.5 }));
  const c = Math.cos(ang) * rad * 0.75, s = Math.sin(ang) * rad * 0.75;
  r.carve(segment(x - c, y - s, x + c, y + s, 0.28), 0.9, 0.3);
}

/** the frame's cast shadow on what it holds: a soft dark band inside the opening (light from the top left) */
export function innerShadow(c: HTMLCanvasElement, k: number, ox: number, oy: number, ow: number, oh: number, depth = 7, a = 0.42) {
  const g = c.getContext('2d')!;
  const x0 = Math.round(ox * k), y0 = Math.round(oy * k), w = Math.round(ow * k), h = Math.round(oh * k), d = depth * k;
  const band = (x: number, y: number, ww: number, hh: number, gx0: number, gy0: number, gx1: number, gy1: number, aa: number) => {
    const gr = g.createLinearGradient(gx0, gy0, gx1, gy1);
    gr.addColorStop(0, `rgba(24, 12, 6, ${aa})`); gr.addColorStop(0.35, `rgba(24, 12, 6, ${aa * 0.45})`); gr.addColorStop(1, 'rgba(24, 12, 6, 0)');
    g.fillStyle = gr; g.fillRect(x, y, ww, hh);
  };
  g.save();
  g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  band(x0, y0, w, d, 0, y0, 0, y0 + d, a);               // under the top rail (deepest: the light is above)
  band(x0, y0, d * 0.8, h, x0, 0, x0 + d * 0.8, 0, a * 0.8); // beside the left stile
  band(x0 + w - d * 0.45, y0, d * 0.45, h, x0 + w, 0, x0 + w - d * 0.45, 0, a * 0.35);
  band(x0, y0 + h - d * 0.4, w, d * 0.4, 0, y0 + h, 0, y0 + h - d * 0.4, a * 0.3);
  g.restore();
}

const NINES = new Map<string, Nine>();
function nine(key: string, make: () => Nine): Nine {
  const kk = key + '@' + deviceK();
  let n = NINES.get(kk);
  if (!n) { n = make(); if (texReady.peek()) NINES.set(kk, n); }
  return n;
}

// ------------------------------------------------------------------ panel frames

/** Which rail a point of a frame belongs to (for grain direction): mitred at 45 degrees. */
const railOf = (x: number, y: number, w: number, h: number) => {
  const dl = x, dr = w - x, dt = y, db = h - y, m = Math.min(dl, dr, dt, db);
  return m === dt ? 't' : m === db ? 'b' : m === dl ? 'l' : 'r';
};

/**
 * A carved panel frame: a moulded rail `t` units wide (outer lip, cove, bead) with round outer corners, mitred
 * corners, a gilt bead on the inside edge and (optionally) brass corner brackets. The opening is clear, with
 * the frame's shadow on it. `m` = shadow margin.
 */
export function panelFrame(kind: WoodName = 'walnut', t = 16, o: { brass?: boolean; gilt?: boolean; r?: number; inner?: number; m?: number; tag?: string } = {}): Nine {
  const m = o.m ?? 10, sh = o.inner ?? 8, c = 56;
  const s = m + t + sh, W = 2 * s + c - 2 * m;
  return nine(`panel:${kind}:${t}:${o.brass}:${o.gilt}:${o.r}:${sh}:${m}`, () => {
    const k = deviceK(3);
    const r = new Real(W, W, k, m);
    const outer = box(0, 0, W, W, o.r ?? 14), inner = box(t, t, W - 2 * t, W - 2 * t, 1.5);
    const ring = subtract(outer, inner);
    const mats: Record<string, Material> = {
      t: wood(kind, { along: 'x', oy: 40 }), b: wood(kind, { along: 'x', oy: 180 }), l: wood(kind, { along: 'y', ox: 90 }), rr: wood(kind, { along: 'y', ox: 300 }),
    };
    const prof = moulding(6, t);
    const hOf = (x: number, y: number) => prof(x, y, Math.max(0, -outer(x, y)));
    for (const side of ['t', 'b', 'l', 'r'] as const) {
      const tri: [number, number][] = side === 't' ? [[-1, -1], [W + 1, -1], [W / 2, W / 2]] : side === 'b' ? [[-1, W + 1], [W + 1, W + 1], [W / 2, W / 2]] : side === 'l' ? [[-1, -1], [-1, W + 1], [W / 2, W / 2]] : [[W + 1, -1], [W + 1, W + 1], [W / 2, W / 2]];
      const sel = polygon(tri);
      r.part(inter(ring, sel), hOf, mats[side === 'r' ? 'rr' : side]);
    }
    // mitre seams
    for (const [x0, y0, x1, y1] of [[0, 0, t, t], [W, 0, W - t, t], [0, W, t, W - t], [W, W, W - t, W - t]]) r.carve(segment(x0, y0, x1, y1, 0.35), 0.8, 0.4);
    if (o.gilt !== false) {
      // a gilt bead along the opening
      const g = subtract(box(t - 2.6, t - 2.6, W - 2 * t + 5.2, W - 2 * t + 5.2, 2.5), inner);
      r.part(g, (x, y) => hOf(x, y) * 0.55 + 1.6 * Math.sqrt(Math.max(0, 1 - ((-g(x, y)) / 1.3 - 1) ** 2)), metal(GOLD, { polish: 0.8 }));
    }
    if (o.brass !== false) {
      for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, W, 1, -1], [W, W, -1, -1]] as [number, number, number, number][]) {
        const L = t + 9, B = 7.5;
        const pts: [number, number][] = [[cx + sx * 2, cy + sy * 2], [cx + sx * L, cy + sy * 2], [cx + sx * L, cy + sy * B], [cx + sx * B, cy + sy * B], [cx + sx * B, cy + sy * L], [cx + sx * 2, cy + sy * L]];
        const pl = union(polygon(pts), circle(cx + sx * L, cy + sy * (B / 2 + 1), B / 2 - 1), circle(cx + sx * (B / 2 + 1), cy + sy * L, B / 2 - 1));
        r.part(pl, bevel(2.2, 1.6, 6.4), metal(BRASS_OLD, { polish: 0.55 }));
        screw(r, cx + sx * (L - 1), cy + sy * (B / 2 + 1), 1.5, 0.4, 6.4);
        screw(r, cx + sx * (B / 2 + 1), cy + sy * (L - 1), 1.5, 2.1, 6.4);
      }
    }
    const cv = r.canvas({ shadow: { dy: 4, blur: 9, a: 0.45 }, aoR: 3 });
    innerShadow(cv, k, m + t, m + t, W - 2 * t, W - 2 * t, sh, 0.45);
    return { url: toURL(cv, 0.92), s: [s, s, s, s], o: m, bw: [t, t, t, t], fill: false, k };
  });
}

// ------------------------------------------------------------------ buttons

export type BtnHue = 'green' | 'gold' | 'red' | 'night' | 'cream' | 'oak' | 'grey' | 'plum' | 'sky';
const HUE: Record<BtnHue, { face: RGB; lip: RGB; rim?: RGB; mat?: 'cloth' | 'wood' | 'metal' }> = {
  green: { face: hex('#2f8a52'), lip: hex('#174a2b') },
  gold: { face: hex('#e2ac4a'), lip: hex('#7a5418'), mat: 'metal' },
  red: { face: hex('#b8403f'), lip: hex('#5e1a1c') },
  night: { face: hex('#2f4f9a'), lip: hex('#142553') },
  plum: { face: hex('#7c3f8e'), lip: hex('#3c1846') },
  sky: { face: hex('#3d8fc4'), lip: hex('#174566') },
  cream: { face: hex('#efe3c8'), lip: hex('#9c8462'), mat: 'cloth' },
  oak: { face: hex('#b07a3c'), lip: hex('#5a3418'), mat: 'wood' },
  grey: { face: hex('#9b968c'), lip: hex('#5c5850') },
};

/**
 * An enamel button: a rounded plaque with a thin brass rim on a darker body (its side wall shows below the
 * face as a lip). `down` presses the face into the body. Layout borders: 12 top, 12 sides, 16 bottom.
 */
export function button(hue: BtnHue, down = false, o: { r?: number; rim?: boolean } = {}): Nine {
  const m = 6, lip = 4, R = o.r ?? 11;
  const W = 64, H = 56, top = 12, side = 12, bot = 16;
  return nine(`btn:${hue}:${down}:${R}:${o.rim}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const h = HUE[hue];
    const press = down ? lip - 1 : 0, fh = H - lip - 2;
    const body = box(0, 2, W, H - 2, R + 1);
    const face = box(1.2, press, W - 2.4, fh, R);
    // body / side wall
    r.part(body, bevel(4, 2), enamel(h.lip, { gloss: 0.4 }));
    const faceMat: Material = h.mat === 'metal' ? metal(h.face, { polish: 0.75 }) : h.mat === 'wood' ? wood('oak', { along: 'x', ox: 30 }) : h.mat === 'cloth' ? cloth('linen', h.face, { scale: 2.4, amt: 0.6 }) : enamel(h.face);
    // brass rim, then the face
    if (o.rim !== false && hue !== 'gold') r.part(face, bevel(6, 1.4, 2), metal(hue === 'grey' ? hex('#a9a296') : BRASS_OLD, { polish: 0.65 }));
    const inset = o.rim !== false && hue !== 'gold' ? 1.6 : 0;
    const f2 = box(1.2 + inset, press + inset, W - 2.4 - inset * 2, fh - inset * 2, R - inset);
    r.part(f2, pillow(3.2, 7, 6.5), faceMat);
    const cv = r.canvas({ shadow: { dy: down ? 1 : 2.5, blur: down ? 2 : 4, a: down ? 0.3 : 0.42 }, aoR: 2, ao: 0.6 });
    return { url: toURL(cv, 0.93), s: [top + m, side + m, bot + m, side + m], o: m, bw: [top, side, bot, side], fill: true, k };
  });
}

// ------------------------------------------------------------------ small frames

/** A leather tab / segment: stitched edge, rounded corners. `on` = gilt brass. */
export function tab(on = false, hue: RGB = hex('#7a4b2a')): Nine {
  const m = 4, W = 48, H = 40, b = 10;
  return nine(`tab:${on}:${hue.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const sh = box(0, 0, W, H, 8);
    if (on) {
      r.part(sh, bevel(4, 3), metal(GOLD, { polish: 0.7 }));
      r.carve(subtract(box(3, 3, W - 6, H - 6, 6), box(3.9, 3.9, W - 7.8, H - 7.8, 5.2)), 0.6, 0.4);
    } else {
      r.part(sh, pillow(3, 6), leather(hue));
      // a stitched seam just inside the edge
      for (let x = 7; x < W - 6; x += 3.2) { r.carve(segment(x, 3.2, x + 1.6, 3.2, 0.42), 0.5, 0.4); r.carve(segment(x, H - 3.2, x + 1.6, H - 3.2, 0.42), 0.5, 0.4); }
      for (let y = 7; y < H - 6; y += 3.2) { r.carve(segment(3.2, y, 3.2, y + 1.6, 0.42), 0.5, 0.4); r.carve(segment(W - 3.2, y, W - 3.2, y + 1.6, 0.42), 0.5, 0.4); }
    }
    const cv = r.canvas({ shadow: { dy: 1.5, blur: 2.5, a: 0.36 }, aoR: 2, ao: 0.5 });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/**
 * An item tray: a brass rim around a sunken, linen-lined well. `state`: 'off' brass, 'on' gold with a warm
 * glow, 'locked' dark iron, 'slot' (old slot_gold) a softer gilt.
 */
export function tray(state: 'off' | 'on' | 'locked' | 'gold' = 'off', b = 9): Nine {
  const m = 5, W = 56, H = 56;
  return nine(`tray:${state}:${b}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const outer = box(0, 0, W, H, 9), well = box(b - 2, b - 2, W - 2 * b + 4, H - 2 * b + 4, 6);
    const rimCol = state === 'on' ? hex('#f0c45a') : state === 'locked' ? IRON : state === 'gold' ? GOLD : BRASS_OLD;
    r.part(outer, (x, y) => { const d = -outer(x, y); return 1 + 3.2 * Math.sqrt(clamp(d / 3)) - (d > b - 3 ? (d - (b - 3)) * 0.6 : 0); }, metal(rimCol, { polish: state === 'locked' ? 0.3 : 0.7 }));
    const lining = state === 'locked' ? cloth('felt', hex('#4a4a50'), { scale: 2.6 }) : state === 'on' ? cloth('linen', hex('#f7e7bf'), { scale: 2.4 }) : cloth('linen', hex('#e9dcc0'), { scale: 2.4 });
    r.part(well, (x, y) => { const d = -well(x, y); return -1.2 + Math.min(0.6, d * 0.2); }, lining);
    if (state === 'on') r.paint(subtract(outer, box(2.4, 2.4, W - 4.8, H - 4.8, 7)), metal(hex('#ffe08a'), { polish: 0.9 }));
    const cv = r.canvas({ shadow: { dy: 2, blur: 3, a: 0.34 }, aoR: 3, ao: 1.1 });
    if (state === 'on') {
      // a warm glow round the chosen tray
      const g = cv.getContext('2d')!;
      g.globalCompositeOperation = 'destination-over';
      g.shadowColor = 'rgba(255, 200, 90, 0.85)'; g.shadowBlur = 5 * k;
      g.strokeStyle = 'rgba(255, 210, 110, 0.9)'; g.lineWidth = 2 * k;
      const p = m * k, w = W * k, h = H * k, rr = 9 * k;
      g.beginPath(); g.roundRect(p, p, w, h, rr); g.stroke();
    }
    const s = b + m + 3;
    return { url: toURL(cv, 0.93), s: [s, s, s, s], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** A small walnut chip plaque (badges, counters). */
export function chip(kind: WoodName = 'walnut'): Nine {
  const m = 4, W = 44, H = 30, b = 8;
  return nine(`chip:${kind}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    r.part(box(0, 0, W, H, 8), bevel(3.5, 3), wood(kind, { along: 'x', oy: 70 }));
    const cv = r.canvas({ shadow: { dy: 1.5, blur: 2.5, a: 0.38 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b - 4, b, b - 4, b], fill: true, k };
  });
}

/** A glass tube channel for bars (sunk into a dark slot). */
export function barTrack(): Nine {
  const m = 3, W = 40, H = 20, b = 8;
  return nine('bartrack', () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    r.part(box(0, 0, W, H, H / 2), bevel(2, 2), metal(BRASS_OLD, { polish: 0.6 }));
    r.part(box(2.4, 2.4, W - 4.8, H - 4.8, (H - 4.8) / 2), (_x, y) => 2 - 1.6 * Math.sqrt(Math.max(0, 1 - ((y - H / 2) / ((H - 4.8) / 2)) ** 2)), matte('#2a2230', { spec: 0.6, shin: 60, coat: 0.5 }));
    const cv = r.canvas({ shadow: { dy: 1, blur: 2, a: 0.3 }, aoR: 2, ao: 1.2 });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b - 2, b, b - 2, b], fill: true, k };
  });
}

/** The liquid in a bar: a glossy rounded rod of light. */
export function barFill(col: RGB): Nine {
  const m = 0, W = 30, H = 12, b = 6;
  return nine(`barfill:${col.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const dark = mix(col, [40, 20, 10], 0.35);
    const g = (_x: number, y: number): RGB => {
      const t = y / H;
      if (t < 0.18) return mix([255, 252, 232], col, t / 0.18 * 0.7);
      if (t < 0.32) return mix(mix([255, 252, 232], col, 0.7), col, (t - 0.18) / 0.14);
      return mix(col, dark, (t - 0.32) / 0.68);
    };
    r.part(box(0, 0, W, H, H / 2), 1, glow(g));
    const cv = r.canvas({ shadow: false });
    return { url: toURL(cv, 0.93), s: [b, b, b, b], o: 0, bw: [b, b, b, b], fill: true, k };
  });
}

/** A satin ribbon banner with notched, folded-back tails. */
export function ribbon(col: RGB): Nine {
  const m = 5, W = 120, H = 34, tail = 22, b = 6;
  return nine(`ribbon:${col.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const dark = mix(col, [20, 8, 12], 0.45);
    // the tails, behind and lower
    const tl = polygon([[0, 8], [tail + 4, 8], [tail + 4, H], [0, H], [7, H / 2 + 4]]);
    const tr = polygon([[W, 8], [W - tail - 4, 8], [W - tail - 4, H], [W, H], [W - 7, H / 2 + 4]]);
    const satin = cloth('velvet', col, { scale: 2, amt: 0.25 });
    r.part(tl, pillow(2.5, 5), { ...cloth('velvet', dark, { amt: 0.25 }), sheen: 0.3 });
    r.part(tr, pillow(2.5, 5), { ...cloth('velvet', dark, { amt: 0.25 }), sheen: 0.3 });
    // the fold shadows
    r.part(polygon([[tail - 2, H - 6], [tail + 6, H - 6], [tail + 6, H - 1], [tail + 2, H - 1]]), 3, matte(mix(dark, [0, 0, 0], 0.4)));
    r.part(polygon([[W - tail + 2, H - 6], [W - tail - 6, H - 6], [W - tail - 6, H - 1], [W - tail - 2, H - 1]]), 3, matte(mix(dark, [0, 0, 0], 0.4)));
    // the front band, gently curved
    const band = box(tail - 6, 0, W - 2 * tail + 12, H - 6, 3);
    r.part(band, (x, y, ins) => 4 + 2.2 * Math.sqrt(clamp(ins / 4)) + 1.4 * Math.sin((x - (tail - 6)) / (W - 2 * tail + 12) * Math.PI) - 0 * y, { ...satin, spec: 0.35, shin: 20, sheen: 0.45 });
    for (const yy of [3.2, H - 9.2]) for (let x = tail - 2; x < W - tail + 2; x += 3) r.carve(segment(x, yy, x + 1.5, yy, 0.35), 0.5, 0.35);
    const cv = r.canvas({ shadow: { dy: 2, blur: 3, a: 0.38 } });
    return { url: toURL(cv, 0.93), s: [b + m, tail + m, b + 6 + m, tail + m], o: m, bw: [b, tail - 4, b + 6, tail - 4], fill: true, k };
  });
}

/** A paper speech bubble (white card stock, soft rounded). */
export function bubbleFrame(think = false): Nine {
  const m = 6, W = 60, H = 52, b = 12;
  return nine(`bubble:${think}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const sh = think ? union(box(4, 4, W - 8, H - 8, 18), circle(12, 12, 10), circle(W - 12, 12, 10), circle(12, H - 12, 10), circle(W - 12, H - 12, 10)) : box(0, 0, W, H, 14);
    r.part(sh, bevel(2.2, 4), paperMat('paper', { tint: [255, 252, 246], scale: 1.4 }));
    const cv = r.canvas({ shadow: { dy: 3, blur: 6, a: 0.32 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** A square sticky note (honey yellow paper, a curled corner, a strip of tape). */
export function stickyFrame(tint: RGB = hex('#f6dc88')): Nine {
  const m = 6, W = 64, H = 60, b = 12;
  return nine(`sticky:${tint.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const sh = torn(box(0, 0, W, H, 2), 0.5, 3);
    r.part(sh, (x, y, ins) => 1 + Math.min(1, ins * 0.4) + Math.max(0, (x + y - (W + H - 18)) * 0.25), paperMat('paper', { tint, scale: 1.4 }));
    const cv = r.canvas({ shadow: { dy: 3, blur: 5, a: 0.32 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** An inset field (text inputs): linen-backed paper sunk into the surface. */
export function fieldFrame(): Nine {
  const m = 2, W = 40, H = 36, b = 8;
  return nine('field', () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const o = box(0, 0, W, H, 8), i = box(2.2, 2.2, W - 4.4, H - 4.4, 6);
    r.part(o, bevel(2.4, 1.6), wood('walnut', { along: 'x' }));
    r.part(i, (x, y) => -1 + Math.min(0.8, -i(x, y) * 0.25), paperMat('paper', { tint: [255, 250, 240] }));
    const cv = r.canvas({ shadow: { dy: -0.6, blur: 1, a: 0.25 }, aoR: 3, ao: 1.4 });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** A brass plaque (engraved border, four screws). */
export function plaqueFrame(col: RGB = BRASS_OLD): Nine {
  const m = 4, W = 64, H = 32, b = 9;
  return nine(`plaque:${col.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    r.part(box(0, 0, W, H, 4), bevel(3, 2.5), metal(col, { polish: 0.6 }));
    r.carve(subtract(box(3.5, 3.5, W - 7, H - 7, 2.5), box(4.3, 4.3, W - 8.6, H - 8.6, 2)), 0.6, 0.4);
    screw(r, 5.5, H / 2, 1.3, 0.3, 3); screw(r, W - 5.5, H / 2, 1.3, 1.9, 3);
    const cv = r.canvas({ shadow: { dy: 1.5, blur: 2.5, a: 0.38 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + 4 + m, b + m, b + 4 + m], o: m, bw: [b - 2, b + 2, b - 2, b + 2], fill: true, k };
  });
}

/** A dark leather tooltip. */
export function tooltipFrame(): Nine {
  const m = 4, W = 36, H = 30, b = 8;
  return nine('tooltip', () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    r.part(box(0, 0, W, H, 7), pillow(2.4, 5), leather(hex('#3b2416')));
    const cv = r.canvas({ shadow: { dy: 2, blur: 4, a: 0.4 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** A round brass/enamel medallion (fixed size art) for portraits and seals. */
export function medallionArt(d = 60, hue: RGB = hex('#2f4f9a')): string {
  return cached(`medal:${d}:${hue.join()}`, () => {
    const m = 4, k = deviceK(3);
    const r = new Real(d, d, k, m);
    const c = d / 2;
    r.part(circle(c, c, c), rim(4, d * 0.16, 1), metal(GOLD, { polish: 0.75 }));
    r.part(circle(c, c, c * 0.7), pillow(2.2, c * 0.5, 1.6), enamel(hue));
    return r.url({ shadow: { dy: 2, blur: 3, a: 0.4 } });
  });
}

/**
 * A round button (fixed art, `d` units across plus a 4-unit shadow margin all round): a domed enamel or
 * brass coin in a brass bezel. Show it at (d + 8) px with a -4 px margin.
 */
export function roundButton(d = 44, hue: BtnHue | 'brass' | 'walnut' = 'brass', down = false): string {
  return cached(`round:${d}:${hue}:${down}`, () => {
    const m = 4, k = deviceK(3), r = new Real(d, d, k, m), c = d / 2;
    r.part(circle(c, c + 1, c - 0.5), bevel(3, 2), metal(BRASS_OLD, { polish: 0.6 }));
    const face: Material = hue === 'brass' ? metal(GOLD, { polish: 0.8 }) : hue === 'walnut' ? wood('walnut', { along: 'x' }) : HUE[hue].mat === 'cloth' ? cloth('linen', HUE[hue].face) : enamel(HUE[hue].face);
    const press = down ? 1 : 0;
    r.part(circle(c, c - 0.5 + press, c - 3.2), (x, y) => 4 + 2.6 * Math.sqrt(Math.max(0, 1 - ((x - c) ** 2 + (y - c + 0.5 - press) ** 2) / ((c - 3.2) ** 2))) ** 0.7, face);
    return r.url({ shadow: { dy: down ? 1 : 2, blur: down ? 2 : 3.5, a: 0.42 } });
  });
}

/** The speech bubble's tail (fixed art 18 x 14 units, no margin): matches bubble_bw. */
export function bubbleTail(): string {
  return cached('bubtail', () => {
    const k = deviceK(3), r = new Real(18, 16, k, 3);
    r.part(polygon([[0, -4], [16, -4], [3, 15]]), bevel(2.2, 3), paperMat('paper', { tint: [255, 252, 246], scale: 1.4 }));
    return r.url({ shadow: { dy: 3, blur: 4, a: 0.3 } });
  });
}

/** A thin picture-frame moulding: wood, or polished brass / dark iron (opening clear, `t` units). */
export function thinFrame(kind: 'oak' | 'walnut' | 'brass' | 'iron' | 'gold', t = 7): Nine {
  if (kind === 'oak' || kind === 'walnut') return panelFrame(kind, t, { brass: false, gilt: false, r: 4, inner: 4, m: 5 });
  const m = 5, sh = 4, c = 40, s = m + t + sh, W = 2 * s + c - 2 * m;
  return nine(`thinm:${kind}:${t}`, () => {
    const k = deviceK(3), r = new Real(W, W, k, m);
    const outer = box(0, 0, W, W, 4), ring = subtract(outer, box(t, t, W - 2 * t, W - 2 * t, 1));
    const col = kind === 'iron' ? IRON : kind === 'gold' ? hex('#f0c45a') : GOLD;
    r.part(ring, (x, y) => { const u = clamp(-outer(x, y) / t); return 1 + 3.2 * Math.sin(u * Math.PI) ** 0.6; }, metal(col, { polish: kind === 'iron' ? 0.35 : 0.8 }));
    const cv = r.canvas({ shadow: { dy: 2, blur: 4, a: 0.4 } });
    innerShadow(cv, k, m + t, m + t, W - 2 * t, W - 2 * t, sh, 0.4);
    return { url: toURL(cv, 0.92), s: [s, s, s, s], o: m, bw: [t, t, t, t], fill: false, k };
  });
}

/** A carved sign board (filled): bevelled planks of `kind`, four brass screws. */
export function signBoard(kind: WoodName = 'walnut'): Nine {
  const m = 5, W = 96, H = 44, b = 10;
  return nine(`sign:${kind}`, () => {
    const k = deviceK(3), r = new Real(W, H, k, m);
    r.part(box(0, 0, W, H, 6), bevel(4, 3.5), wood(kind, { along: 'x', oy: 120 }));
    for (const [x, y] of [[5, 5], [W - 5, 5], [5, H - 5], [W - 5, H - 5]]) screw(r, x, y, 1.4, x * 0.1, 4);
    const cv = r.canvas({ shadow: { dy: 3, blur: 5, a: 0.42 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b - 2, b, b - 2, b], fill: true, k };
  });
}

/** A paper note with a deckled edge (filled). tint: cream / blue / yellow / pink. */
export function paperNote(tint: 'cream' | 'blue' | 'yellow' | 'pink' | 'kraft' = 'cream', seed = 1): Nine {
  const m = 6, W = 72, H = 64, b = 12;
  return nine(`note:${tint}:${seed}`, () => {
    const k = deviceK(3), r = new Real(W, H, k, m);
    const T: Record<string, RGB> = { cream: [255, 250, 238], blue: [222, 236, 248], yellow: [255, 236, 170], pink: [252, 214, 208], kraft: [255, 255, 255] };
    r.part(torn(box(0, 0, W, H, 1.5), 0.8, seed), (x, y, ins) => 1 + Math.min(1.2, ins * 0.5) + Math.max(0, (x + y - (W + H - 16)) * 0.18), paperMat(tint === 'kraft' ? 'kraft' : 'paper', { tint: T[tint], scale: 1.5, ox: seed * 37 }));
    const cv = r.canvas({ shadow: { dy: 2.5, blur: 4.5, a: 0.34 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** A tooled leather frame (filled with leather): stitched edge and a gilt fillet; the opening is clear. */
export function leatherFrame(hue: string = '#2c6b43', t = 14): Nine {
  const m = 6, sh = 5, c = 40, s = m + t + sh, W = 2 * s + c - 2 * m;
  return nine(`lthf:${hue}:${t}`, () => {
    const k = deviceK(3), r = new Real(W, W, k, m);
    const outer = box(0, 0, W, W, 8), open = box(t, t, W - 2 * t, W - 2 * t, 2);
    r.part(subtract(outer, open), (x, y) => { const d = -outer(x, y); return 2 + 2.6 * Math.sqrt(clamp(d / 4)) - (d > t - 2 ? (d - (t - 2)) * 0.8 : 0); }, leather(hue, { scale: 2 }));
    const st = subtract(box(3.2, 3.2, W - 6.4, W - 6.4, 6), box(3.9, 3.9, W - 7.8, W - 7.8, 5.4));
    r.carve(st, 0.5, 0.35);
    r.paint(subtract(box(t - 4.6, t - 4.6, W - 2 * t + 9.2, W - 2 * t + 9.2, 3), box(t - 3.6, t - 3.6, W - 2 * t + 7.2, W - 2 * t + 7.2, 2.5)), metal(GOLD, { polish: 0.7 }));
    const cv = r.canvas({ shadow: { dy: 3, blur: 6, a: 0.42 } });
    innerShadow(cv, k, m + t, m + t, W - 2 * t, W - 2 * t, sh, 0.42);
    return { url: toURL(cv, 0.92), s: [s, s, s, s], o: m, bw: [t, t, t, t], fill: false, k };
  });
}

// ------------------------------------------------------------------ registry and CSS

/** Every named frame (the old pixel frame names map onto these). */
export const NINE: Record<string, () => Nine> = {
  wood: () => panelFrame('oak', 12, { brass: false, r: 10, inner: 6, m: 8 }),
  wood_dark: () => panelFrame('walnut', 12, { brass: false, r: 10, inner: 6, m: 8 }),
  walnut: () => panelFrame('walnut', 16, { r: 14 }),
  walnut_thin: () => panelFrame('walnut', 10, { brass: false, r: 9, inner: 5, m: 7 }),
  ebony: () => panelFrame('ebony', 14, { r: 12 }),
  oak_panel: () => panelFrame('oak', 14, { r: 12 }),
  button_green: () => button('green'), button_green_hover: () => button('green'), button_green_down: () => button('green', true),
  button_gold: () => button('gold'), button_gold_down: () => button('gold', true),
  button_red: () => button('red'), button_red_down: () => button('red', true),
  button_night: () => button('night'), button_night_down: () => button('night', true),
  button_cream: () => button('cream'), button_cream_down: () => button('cream', true),
  button_oak: () => button('oak'), button_oak_down: () => button('oak', true),
  button_plum: () => button('plum'), button_plum_down: () => button('plum', true),
  button_sky: () => button('sky'), button_sky_down: () => button('sky', true),
  button_disabled: () => button('grey'),
  tab: () => tab(false), tab_active: () => tab(true),
  tab_green: () => tab(false, hex('#2c6b43')), tab_blue: () => tab(false, hex('#2b4b86')),
  slot_brass: () => tray('off'), slot_gold: () => tray('gold'), slot_gold_active: () => tray('on'), slot_locked: () => tray('locked'),
  chip: () => chip('walnut'), chip_oak: () => chip('oak'),
  bar_track: () => barTrack(),
  bar_fill_gold: () => barFill(hex('#f2b63c')), bar_fill_green: () => barFill(hex('#4cbf6c')), bar_fill_red: () => barFill(hex('#e0574f')), bar_fill_blue: () => barFill(hex('#5aa7ff')),
  ribbon_green: () => ribbon(hex('#2f8a52')), ribbon_red: () => ribbon(hex('#b8343c')), ribbon_blue: () => ribbon(hex('#2f5aa8')), ribbon_gold: () => ribbon(hex('#d9a33c')),
  bubble_bw: () => bubbleFrame(false), bubble_think: () => bubbleFrame(true),
  sticky_note: () => stickyFrame(), sticky_pink: () => stickyFrame(hex('#f6c2bc')), sticky_blue: () => stickyFrame(hex('#c8dcf0')), sticky_green: () => stickyFrame(hex('#cfe6b8')),
  input: () => fieldFrame(),
  plaque: () => plaqueFrame(),
  tooltip: () => tooltipFrame(),
};

/** CSS declarations for a frame. `scale` multiplies the layout borders (old frameStyle scale 2 ~ 1). */
export function nineCSS(name: string, o: { fill?: boolean; bw?: number[] | false } = {}): string {
  const make = NINE[name] ?? NINE.walnut;
  const n = make();
  const sl = n.s.map((v) => Math.round(v * n.k)).join(' ');
  const bw = o.bw === false ? null : (o.bw ?? n.bw);
  return [
    'border-style:solid', 'border-color:transparent',
    bw ? `border-width:${bw.map((v) => v + 'px').join(' ')}` : '',
    `border-image-source:url("${n.url}")`,
    `border-image-slice:${sl}${(o.fill ?? n.fill) ? ' fill' : ''}`,
    `border-image-width:${n.s.map((v) => v + 'px').join(' ')}`,
    `border-image-outset:${n.o}px`,
    `border-image-repeat:${n.rep ?? 'stretch'}`,
  ].filter(Boolean).join(';');
}

/** Drop-in for the old pixel frames: same names, realistic art (the scale argument is ignored). */
export const frameStyle = (name: string, _scale = 2) => nineCSS(name);
export const frameURL = (name: string) => (NINE[name] ?? NINE.walnut)().url;
