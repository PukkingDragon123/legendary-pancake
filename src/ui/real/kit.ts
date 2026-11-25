// The realistic UI kit: 9-slice frames (shown with border-image, so they fit any size without repainting)
// painted by the material painter (paint.ts) at device resolution, plus the CSS that shows them.
//
//   NINE[name]()          paint (once, cached) and describe a frame
//   nineCSS(name, o)      CSS declarations that dress an element in it (border-image, widths, outset)
//   frameStyle(name)      drop-in for the old pixel frames' frameStyle(): same names, realistic art
//
// [ui10] Crafted, not plain: carved walnut / oak / ebony frames with pierced brass filigree corner pieces (or
// carved acanthus corners and rosettes), an inlaid boxwood stringing line and a row of gilt pearls round the
// opening; enamel buttons with a milgrain brass rim, a gold pinstripe and four rivets; stitched leather index
// tabs with flared feet; brass-rimmed linen trays with a beaded edge and rivets; glass level tubes between
// turned brass ferrules; satin ribbons with stitched edges and notched, folded tails; name plates with notched
// corners, engraved scrolls and screws; deckled, printed paper cards; brass levers in carved tracks; real
// toggle switches; a carved cartouche crest. Everything has a thin warm-black outline like the 3D world.
// Frames whose edges carry a repeating pattern tile it (`border-image-repeat: round`, every repeating middle
// made seamless with `tileable` and periodic noise), so beads and stitches keep their spacing at any size.
import {
  BRASS_OLD, GOLD, IRON, INK, Real, SILVER, bevel, box, cached, circle, clamp, cloth, curve, cutBox, deviceK, dome, ellipse, enamel, glow, hex, leather, matte, metal,
  mix, moulding, offset, paperMat, pillow, pnoise, polygon, rim, segment, spiralPts, subtract, texAlb, tileable, toURL, torn, tubeX, union, wood,
  type Material, type RGB, type SDF, type WoodName,
} from './paint.ts';
import { acornShapes, alongRect, aroundCircle, beads, carvedCorner, cScroll, filigreeCorner, milgrain, oakLeaf, owlCrest, rivet, rosette, stitches, stringing, THREAD } from './orn.ts';
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
  r.part(circle(x, y, rad), (px, py) => z + 1.2 + 1.1 * Math.sqrt(Math.max(0, 1 - ((px - x) ** 2 + (py - y) ** 2) / (rad * rad))), metal(BRASS_OLD, { polish: 0.5 }), { line: true });
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
  g.globalCompositeOperation = 'destination-over'; // [ui10] under the frame's outline and corner pieces
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

export type CornerKind = 'filigree' | 'gold' | 'silver' | 'carved' | 'rosette' | 'none';

/**
 * A carved panel frame: a moulded rail `t` units wide (outer lip, cove with an inlaid stringing line, bead),
 * mitred corners, a gilt fillet with a row of pearls round the opening, and corner pieces: pierced brass
 * filigree caps (default), carved acanthus corners or rosettes. The opening is clear, with the frame's
 * shadow on it. `m` = shadow margin. The rails tile (`round`) so the pearls keep their spacing.
 */
export function panelFrame(kind: WoodName = 'walnut', t = 16, o: { brass?: boolean; gilt?: boolean; r?: number; inner?: number; m?: number; tag?: string; corner?: CornerKind; pearls?: boolean } = {}): Nine {
  const m = o.m ?? 10, sh = o.inner ?? 8, c = 56;
  const corner: CornerKind = o.corner ?? (o.brass === false ? (t >= 9 ? 'rosette' : 'none') : 'filigree');
  const metalC = corner === 'filigree' || corner === 'gold' || corner === 'silver';
  const L = metalC ? t + 13 : corner === 'carved' ? t + 10 : 0;
  const cs = Math.max(t + sh, L + 2), s = m + cs, W = 2 * cs + c;
  return nine(`panel10:${kind}:${t}:${corner}:${o.gilt}:${o.r}:${sh}:${m}:${o.pearls}`, () => {
    const k = deviceK(3);
    const r = new Real(W, W, k, m);
    // [ui10] angular: bevel-cut outer corners (under the corner pieces), a square opening
    const R = metalC ? 3 : corner === 'carved' ? 5 : Math.max(2.5, t * 0.36);
    const outer = cutBox(0, 0, W, W, R), inner = box(t, t, W - 2 * t, W - 2 * t, 0);
    const ring = subtract(outer, inner);
    const tx = (mm: Material) => tileable(mm, cs, c), ty = (mm: Material) => tileable(mm, 0, 0, cs, c);
    const mats: Record<string, Material> = {
      t: tx(wood(kind, { along: 'x', oy: 40 })), b: tx(wood(kind, { along: 'x', oy: 180 })), l: ty(wood(kind, { along: 'y', ox: 90 })), rr: ty(wood(kind, { along: 'y', ox: 300 })),
    };
    const prof = moulding(6, t);
    const hOf = (x: number, y: number) => prof(x, y, Math.max(0, -outer(x, y)));
    for (const side of ['t', 'b', 'l', 'r'] as const) {
      const tri: [number, number][] = side === 't' ? [[-1, -1], [W + 1, -1], [W / 2, W / 2]] : side === 'b' ? [[-1, W + 1], [W + 1, W + 1], [W / 2, W / 2]] : side === 'l' ? [[-1, -1], [-1, W + 1], [W / 2, W / 2]] : [[W + 1, -1], [W + 1, W + 1], [W / 2, W / 2]];
      r.part(subtract(ring, subtract(ring, polygon(tri))), hOf, mats[side === 'r' ? 'rr' : side]);
    }
    // mitre seams
    for (const [x0, y0, x1, y1] of [[0, 0, t, t], [W, 0, W - t, t], [0, W, t, W - t], [W, W, W - t, W - t]]) { const sg = segment(x0, y0, x1, y1, 0.35); r.carve(sg, 0.8, 0.4); r.line(sg, undefined, 0.35); }
    // an inlaid stringing line in the cove (boxwood on dark woods, ebony on light ones)
    if (t >= 9) {
      const a = t * 0.42, bw = Math.max(0.55, t * 0.045);
      const band = subtract(cutBox(a, a, W - 2 * a, W - 2 * a, Math.max(0, R - a * 0.586)), cutBox(a + bw, a + bw, W - 2 * (a + bw), W - 2 * (a + bw), Math.max(0, R - (a + bw) * 0.586)));
      stringing(r, band, kind === 'oak' || kind === 'honey' ? hex('#3a2418') : hex('#ecc98c'));
      r.line(band, 0.7, 0.32);
    }
    if (o.gilt !== false) {
      // a gilt fillet along the opening, and on it a row of pearls
      const g = subtract(box(t - 2.6, t - 2.6, W - 2 * t + 5.2, W - 2 * t + 5.2, 0), inner);
      if (t >= 9 && o.pearls !== false) {
        r.part(g, (x, y) => hOf(x, y) * 0.45 + 0.6, tx(metal(GOLD, { polish: 0.6 })), { line: 0.8 });
        beads(r, t - 1.3, t - 1.3, W - 2 * t + 2.6, W - 2 * t + 2.6, 0, c / 12, cs, cs, 2.4, metal(GOLD, { polish: 0.85 }), 1.12);
      } else {
        r.part(g, (x, y) => hOf(x, y) * 0.55 + 1.6 * Math.sqrt(Math.max(0, 1 - ((-g(x, y)) / 1.3 - 1) ** 2)), metal(GOLD, { polish: 0.8 }), { line: 0.8 });
      }
    }
    const corners: [number, number, number, number][] = [[0, 0, 1, 1], [W, 0, -1, 1], [0, W, 1, -1], [W, W, -1, -1]];
    if (metalC) {
      const col = corner === 'gold' ? GOLD : corner === 'silver' ? SILVER : BRASS_OLD;
      for (const [cx, cy, sx, sy] of corners) filigreeCorner(r, cx + sx * 0.3, cy + sy * 0.3, sx, sy, L, 6.2, col, t * 0.5);
    } else if (corner === 'carved') {
      const wm = wood(kind, { along: 'x', oy: 260 });
      for (const [cx, cy, sx, sy] of corners) carvedCorner(r, cx, cy, sx, sy, L, 4.4, wm);
    } else if (corner === 'rosette') {
      const wm = wood(kind, { along: 'y', ox: 150 });
      for (const [cx, cy, sx, sy] of corners) rosette(r, cx + sx * t * 0.5, cy + sy * t * 0.5, t * 0.36, 4.6, wm, 8, metal(GOLD, { polish: 0.85 }));
    }
    const cv = r.canvas({ shadow: { dy: 4, blur: 9, a: 0.45 }, aoR: 3 });
    innerShadow(cv, k, m + t, m + t, W - 2 * t, W - 2 * t, sh, 0.45);
    return { url: toURL(cv, 0.92), s: [s, s, s, s], o: m, bw: [t, t, t, t], fill: false, k, rep: 'round' };
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
 * An enamel button: a rounded plaque in a milgrain brass rim on a darker body (its side wall shows below the
 * face as a lip), a fine gold pinstripe and four tiny rivets in its corners. `down` presses the face into the
 * body. Layout borders: 12 top, 12 sides, 16 bottom.
 */
export function button(hue: BtnHue, down = false, o: { r?: number; rim?: boolean } = {}): Nine {
  const m = 6, lip = 4, R = o.r ?? 11;
  const W = 64, H = 56, top = 12, side = 12, bot = 16, cx = W - 2 * side, cy = H - top - bot;
  return nine(`btn10:${hue}:${down}:${R}:${o.rim}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const h = HUE[hue];
    const press = down ? lip - 1 : 0, fh = H - lip - 2;
    const til = (mm: Material) => tileable(mm, side, cx, top, cy);
    // [ui10] square-cut: every outline is a rectangle with its corners bevel-cut (C), no rounding
    const C = Math.min(6, R * 0.55 + 0.5), cIn = (d: number) => Math.max(0.6, C - d * 0.586);
    const body = cutBox(0, 2, W, H - 2, C + 0.6);
    const face = cutBox(1.2, press, W - 2.4, fh, C);
    // body / side wall
    r.part(body, bevel(4, 2), enamel(h.lip, { gloss: 0.4 }));
    const faceMat: Material = til(h.mat === 'metal' ? metal(h.face, { polish: 0.75 }) : h.mat === 'wood' ? wood('oak', { along: 'x', ox: 30 }) : h.mat === 'cloth' ? cloth('linen', h.face, { scale: 2.4, amt: 0.6 }) : enamel(h.face));
    const rimOn = o.rim !== false && hue !== 'gold';
    // a brass frame with a beaded (milgrain) edge, then the face
    if (rimOn) {
      r.part(face, bevel(6, 1.4, 2), til(metal(hue === 'grey' ? hex('#a9a296') : BRASS_OLD, { polish: 0.65 })), { line: 0.8 });
      milgrain(r, 1.2 + 0.8, press + 0.8, W - 2.4 - 1.6, fh - 1.6, cIn(0.8), [cx / 16, cy / 11], side, top, 0.55);
    }
    const inset = rimOn ? 1.7 : 0;
    const f2 = cutBox(1.2 + inset, press + inset, W - 2.4 - inset * 2, fh - inset * 2, cIn(inset));
    r.part(f2, pillow(3.2, 7, 6.5), faceMat, { line: rimOn ? 0.8 : false });
    if (hue !== 'oak' && hue !== 'grey') {
      // a fine pinstripe inset from the face's edge (gold on enamel, a dark line on the gold button)
      const d0 = inset + 2.6, p0 = 1.2 + d0, pw = 0.5;
      const ps = subtract(cutBox(p0, press + d0, W - 2 * p0, fh - 2 * d0, cIn(d0)), cutBox(p0 + pw, press + d0 + pw, W - 2 * p0 - 2 * pw, fh - 2 * d0 - 2 * pw, cIn(d0 + pw)));
      if (hue === 'gold') r.inkFill(ps, 0.35);
      else r.paint(ps, til(metal(hue === 'cream' ? BRASS_OLD : GOLD, { polish: 0.8 })), 0.95);
      // four tiny rivets in the cut corners, between the frame and the pinstripe
      const q = 1.2 + inset + Math.max(2.4, cIn(inset) * 0.5 + 1.2);
      for (const [x, y] of [[q, press + q - 1.2], [W - q, press + q - 1.2], [q, press + fh - q + 1.2], [W - q, press + fh - q + 1.2]] as [number, number][]) rivet(r, x, y, 0.8, 8.6, hue === 'gold' ? hex('#b07a2a') : BRASS_OLD, 0.75);
    }
    const cv = r.canvas({ shadow: { dy: down ? 1 : 2.5, blur: down ? 2 : 4, a: down ? 0.3 : 0.42 }, aoR: 2, ao: 0.6 });
    return { url: toURL(cv, 0.93), s: [top + m, side + m, bot + m, side + m], o: m, bw: [top, side, bot, side], fill: true, k, rep: 'round' };
  });
}

// ------------------------------------------------------------------ small frames

/** the outline of an index tab: angled shoulders, straight sides and splayed feet where it meets its base */
function tabShape(W: number, H: number, f = 3.5, rTop = 7): SDF {
  return polygon([[2 - f, H], [2, H - f], [2, rTop], [2 + rTop, 0], [W - 2 - rTop, 0], [W - 2, rTop], [W - 2, H - f], [W - 2 + f, H]]);
}

/** A leather index tab: stitched shoulders and sides in cream thread, flared feet. `on` = gilt brass. */
export function tab(on = false, hue: RGB = hex('#7a4b2a')): Nine {
  const m = 5, W = 48, H = 40, b = 10, cx = W - 2 * b, cy = H - 2 * b;
  return nine(`tab10:${on}:${hue.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const sh = tabShape(W, H);
    const til = (mm: Material) => tileable(mm, b, cx, b, cy);
    if (on) {
      r.part(sh, bevel(4, 3), til(metal(GOLD, { polish: 0.7 })));
      r.carve(subtract(offset(tabShape(W, H, 0.01, 6), -2.6), offset(tabShape(W, H, 0.01, 6), -3.3)), 0.6, 0.4);
      r.line(subtract(offset(tabShape(W, H, 0.01, 6), -2.6), offset(tabShape(W, H, 0.01, 6), -3.3)), 0.6, 0.25);
    } else {
      r.part(sh, pillow(3, 6), til(leather(hue)));
      stitches(r, 5.2, 3.4, W - 10.4, H - 7, 5.4, [cx / 6, cy / 4], b, b, THREAD.cream, { sides: 'trl', th: 0.52 });
    }
    const cv = r.canvas({ shadow: { dy: 1.5, blur: 2.5, a: 0.36 }, aoR: 2, ao: 0.5 });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k, rep: 'round' };
  });
}

/**
 * An item tray: a brass rim with a beaded edge and four rivets round a sunken, linen-lined well. `state`: 'off'
 * brass, 'on' gold with a warm glow, 'locked' dark iron, 'gold' a softer gilt.
 */
export function tray(state: 'off' | 'on' | 'locked' | 'gold' = 'off', b = 9): Nine {
  const m = 5, W = 56, H = 56, e = b + 3, c = W - 2 * e;
  return nine(`tray10:${state}:${b}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const til = (mm: Material) => tileable(mm, e, c, e, c);
    const outer = cutBox(0, 0, W, H, 7), well = cutBox(b - 2, b - 2, W - 2 * b + 4, H - 2 * b + 4, 3.6);
    const rimCol = state === 'on' ? hex('#f0c45a') : state === 'locked' ? IRON : state === 'gold' ? GOLD : BRASS_OLD;
    r.part(outer, (x, y) => { const d = -outer(x, y); return 1 + 3.2 * Math.sqrt(clamp(d / 3)) - (d > b - 3 ? (d - (b - 3)) * 0.6 : 0); }, til(metal(rimCol, { polish: state === 'locked' ? 0.3 : 0.7 })));
    milgrain(r, 1.7, 1.7, W - 3.4, H - 3.4, 6, c / 12, e, e, 0.55);
    const lining = state === 'locked' ? cloth('felt', hex('#4a4a50'), { scale: 2.6 }) : state === 'on' ? cloth('linen', hex('#f7e7bf'), { scale: 2.4 }) : cloth('linen', hex('#e9dcc0'), { scale: 2.4 });
    r.part(well, (x, y) => { const d = -well(x, y); return -1.2 + Math.min(0.6, d * 0.2); }, til(lining), { line: 0.8 });
    if (state === 'on') r.paint(subtract(outer, cutBox(2.4, 2.4, W - 4.8, H - 4.8, 5.6)), til(metal(hex('#ffe08a'), { polish: 0.9 })));
    for (const [x, y] of [[5.4, 5.4], [W - 5.4, 5.4], [5.4, H - 5.4], [W - 5.4, H - 5.4]]) rivet(r, x, y, 1.2, 3.6, state === 'locked' ? hex('#7a7e86') : rimCol, 0.7);
    const cv = r.canvas({ shadow: { dy: 2, blur: 3, a: 0.34 }, aoR: 3, ao: 1.1 });
    if (state === 'on') {
      // a warm glow round the chosen tray
      const g = cv.getContext('2d')!;
      g.globalCompositeOperation = 'destination-over';
      g.shadowColor = 'rgba(255, 200, 90, 0.85)'; g.shadowBlur = 5 * k;
      g.strokeStyle = 'rgba(255, 210, 110, 0.9)'; g.lineWidth = 2 * k;
      const p = m * k, w = W * k, h = H * k, cc = 7 * k;
      g.beginPath(); g.moveTo(p + cc, p); g.lineTo(p + w - cc, p); g.lineTo(p + w, p + cc); g.lineTo(p + w, p + h - cc); g.lineTo(p + w - cc, p + h); g.lineTo(p + cc, p + h); g.lineTo(p, p + h - cc); g.lineTo(p, p + cc); g.closePath(); g.stroke();
    }
    const s = e + m;
    return { url: toURL(cv, 0.93), s: [s, s, s, s], o: m, bw: [b, b, b, b], fill: true, k, rep: 'round' };
  });
}

/** A small walnut chip plaque (badges, counters) with four brass nails. */
export function chip(kind: WoodName = 'walnut'): Nine {
  const m = 4, W = 44, H = 30, b = 8;
  return nine(`chip10:${kind}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    r.part(cutBox(0, 0, W, H, 5), bevel(3.5, 3), wood(kind, { along: 'x', oy: 70 }));
    for (const [x, y] of [[4.3, 4.3], [W - 4.3, 4.3], [4.3, H - 4.3], [W - 4.3, H - 4.3]]) rivet(r, x, y, 1.05, 3.4);
    const cv = r.canvas({ shadow: { dy: 1.5, blur: 2.5, a: 0.38 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b - 4, b, b - 4, b], fill: true, k };
  });
}

/** A glass tube channel for bars: a dark glass bore with a streak of light between two turned brass ferrules. */
export function barTrack(): Nine {
  const m = 3, W = 40, H = 20, b = 8;
  return nine('bartrack10', () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    // [ui10] a square brass channel (bevel-cut ends) holding the glass tube between two ferrules
    r.part(cutBox(0, 0.6, W, H - 1.2, 2.4), bevel(2, 2), metal(BRASS_OLD, { polish: 0.6 }));
    r.part(box(2.2, 2.6, W - 4.4, H - 5.2, 0), (_x, y) => 2 - 1.6 * Math.sqrt(Math.max(0, 1 - ((y - H / 2) / ((H - 5.2) / 2)) ** 2)), matte('#2a2230', { spec: 0.6, shin: 60, coat: 0.5 }), { line: 0.8 });
    // the ferrules: a squared collar across the tube with two ring grooves and a bright lip
    for (const right of [false, true]) {
      const x0 = right ? W - 7.4 : 0;
      const cap = cutBox(x0, 0, 7.4, H, 1.8);
      r.part(cap, (x, y) => tubeX(H / 2, H / 2, 1.4)(x, y, 0), metal(GOLD, { polish: 0.85, along: 'y' }), { line: 0.9 });
      for (const gx of right ? [x0 + 1.8, x0 + 4.4] : [x0 + 3, x0 + 5.6]) r.carve(box(gx - 0.3, -1, 0.6, H + 2, 0.3), 0.7, 0.3);
    }
    // the glass's long highlight
    r.paint(box(7.6, 5.2, W - 15.2, 1.1, 0.55), glow([255, 250, 236]), 0.28);
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
    r.part(box(0, 0, W, H, 0), 1, glow(g));
    const cv = r.canvas({ shadow: false, outline: false });
    return { url: toURL(cv, 0.93), s: [b, b, b, b], o: 0, bw: [b, b, b, b], fill: true, k };
  });
}

/** A satin ribbon banner: stitched edges, notched tails folded back behind it. */
export function ribbon(col: RGB): Nine {
  const m = 5, W = 120, H = 34, tail = 22, b = 6, cx = W - 2 * tail, cy = H - b - (b + 6);
  return nine(`ribbon10:${col.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const dark = mix(col, [20, 8, 12], 0.45);
    // the tails, behind and lower, with swallowtail notches
    const tl = polygon([[0, 8], [tail + 4, 8], [tail + 4, H], [0, H], [7, H / 2 + 4]]);
    const tr = polygon([[W, 8], [W - tail - 4, 8], [W - tail - 4, H], [W, H], [W - 7, H / 2 + 4]]);
    r.part(tl, pillow(2.5, 5), { ...cloth('velvet', dark, { amt: 0.25 }), sheen: 0.3 }, { line: true });
    r.part(tr, pillow(2.5, 5), { ...cloth('velvet', dark, { amt: 0.25 }), sheen: 0.3 }, { line: true });
    // the fold shadows where the band turns back into the tails
    r.part(polygon([[tail - 2, H - 6], [tail + 6, H - 6], [tail + 6, H - 1], [tail + 2, H - 1]]), 3, matte(mix(dark, [0, 0, 0], 0.4)), { line: 0.8 });
    r.part(polygon([[W - tail + 2, H - 6], [W - tail - 6, H - 6], [W - tail - 6, H - 1], [W - tail - 2, H - 1]]), 3, matte(mix(dark, [0, 0, 0], 0.4)), { line: 0.8 });
    // the front band
    const satin = tileable({ ...cloth('velvet', col, { scale: 2, amt: 0.25 }), spec: 0.35, shin: 20, sheen: 0.45 }, tail, cx, b, cy);
    const band = box(tail - 6, 0, W - 2 * tail + 12, H - 6, 0);
    r.part(band, (_x, _y, ins) => 4 + 2.2 * Math.sqrt(clamp(ins / 4)), satin, { line: true });
    stitches(r, tail - 6, 2.6, W - 2 * tail + 12, H - 11.2, 0, [cx / 19, 4], tail, b, mix(col, [255, 240, 210], 0.65), { sides: 'tb', th: 0.46 });
    const cv = r.canvas({ shadow: { dy: 2, blur: 3, a: 0.38 } });
    return { url: toURL(cv, 0.93), s: [b + m, tail + m, b + 6 + m, tail + m], o: m, bw: [b, tail - 4, b + 6, tail - 4], fill: true, k, rep: 'round' };
  });
}

/** A paper speech bubble (white card stock, soft rounded). */
export function bubbleFrame(think = false): Nine {
  const m = 6, W = 60, H = 52, b = 12;
  return nine(`bubble:${think}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    // [ui10] a card of stock with bevel-cut corners (the thought cloud keeps its puffs)
    const sh = think ? union(box(4, 4, W - 8, H - 8, 18), circle(12, 12, 10), circle(W - 12, 12, 10), circle(12, H - 12, 10), circle(W - 12, H - 12, 10)) : cutBox(0, 0, W, H, 7);
    r.part(sh, bevel(2.2, 4), paperMat('paper', { tint: [255, 252, 246], scale: 1.4 }));
    if (!think) { const rl = subtract(cutBox(3.2, 3.2, W - 6.4, H - 6.4, 5.2), cutBox(3.6, 3.6, W - 7.2, H - 7.2, 5)); r.inkFill(rl, 0.22); }
    const cv = r.canvas({ shadow: { dy: 3, blur: 6, a: 0.32 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** A square sticky note (honey yellow paper, a curled corner). */
export function stickyFrame(tint: RGB = hex('#f6dc88')): Nine {
  const m = 6, W = 64, H = 60, b = 12;
  return nine(`sticky:${tint.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const sh = torn(box(0, 0, W, H, 0), 0.5, 3);
    r.part(sh, (x, y, ins) => 1 + Math.min(1, ins * 0.4) + Math.max(0, (x + y - (W + H - 18)) * 0.25), paperMat('paper', { tint, scale: 1.4 }));
    const cv = r.canvas({ shadow: { dy: 3, blur: 5, a: 0.32 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** An inset field (text inputs): linen-backed paper sunk into a walnut bezel, inked round its lip. */
export function fieldFrame(): Nine {
  const m = 2, W = 40, H = 36, b = 8;
  return nine('field10', () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    const o = cutBox(0, 0, W, H, 4), i = cutBox(2.2, 2.2, W - 4.4, H - 4.4, 2.7);
    r.part(o, bevel(2.4, 1.6), wood('walnut', { along: 'x' }));
    r.part(i, (x, y) => -1 + Math.min(0.8, -i(x, y) * 0.25), paperMat('paper', { tint: [255, 250, 240] }), { line: 0.9 });
    const cv = r.canvas({ shadow: { dy: -0.6, blur: 1, a: 0.25 }, aoR: 3, ao: 1.4 });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k };
  });
}

/** a plate with its corners notched in (quarter-round), the classic name plate */
const notched = (x: number, y: number, w: number, h: number, n: number): SDF => subtract(box(x, y, w, h, 0.8), union(circle(x, y, n), circle(x + w, y, n), circle(x, y + h, n), circle(x + w, y + h, n)));

/** A brass name plate: notched corners, an engraved border and scrolls, two screws. */
export function plaqueFrame(col: RGB = BRASS_OLD): Nine {
  const m = 4, W = 64, H = 32, b = 9;
  return nine(`plaque10:${col.join()}`, () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    r.part(notched(0, 0, W, H, 3.6), bevel(3, 2.5), metal(col, { polish: 0.6 }));
    const eng = subtract(notched(3.4, 3.4, W - 6.8, H - 6.8, 2.6), notched(4.1, 4.1, W - 8.2, H - 8.2, 2.3));
    r.carve(eng, 0.6, 0.4); r.line(eng, 0.6, 0.25);
    // engraved curls above and below each screw
    for (const sx of [1, -1]) for (const sy of [1, -1]) {
      const x = sx > 0 ? 7.6 : W - 7.6, y = H / 2 - sy * 6.2;
      r.carve(curve(spiralPts(x, y, 2.2, 0.5, sy > 0 ? Math.PI * 0.9 : -Math.PI * 0.9, sx * sy * 0.9, 0.24, 0.16, 14)), 0.5, 0.25);
    }
    screw(r, 6.4, H / 2, 1.4, 0.3, 3); screw(r, W - 6.4, H / 2, 1.4, 1.9, 3);
    const cv = r.canvas({ shadow: { dy: 1.5, blur: 2.5, a: 0.38 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + 4 + m, b + m, b + 4 + m], o: m, bw: [b - 2, b + 2, b - 2, b + 2], fill: true, k };
  });
}

/** A dark leather tooltip with a stitched edge. */
export function tooltipFrame(): Nine {
  const m = 4, W = 36, H = 30, b = 8;
  return nine('tooltip10', () => {
    const k = deviceK(3);
    const r = new Real(W, H, k, m);
    r.part(cutBox(0, 0, W, H, 5), pillow(2.4, 5), tileable(leather(hex('#3b2416')), b, W - 2 * b, b, H - 2 * b));
    stitches(r, 2.6, 2.6, W - 5.2, H - 5.2, 3.5, [(W - 2 * b) / 5, (H - 2 * b) / 3.5], b, b, THREAD.linen, { th: 0.44 });
    const cv = r.canvas({ shadow: { dy: 2, blur: 4, a: 0.4 } });
    return { url: toURL(cv, 0.93), s: [b + m, b + m, b + m, b + m], o: m, bw: [b, b, b, b], fill: true, k, rep: 'round' };
  });
}

/** A round brass/enamel medallion (fixed size art) for portraits and seals: a ring of gilt pearls. */
export function medallionArt(d = 60, hue: RGB = hex('#2f4f9a')): string {
  return cached(`medal10:${d}:${hue.join()}`, () => {
    const m = 4, k = deviceK(3);
    const r = new Real(d, d, k, m);
    const c = d / 2;
    r.part(circle(c, c, c), rim(4, d * 0.16, 1), metal(GOLD, { polish: 0.75 }));
    aroundCircle(c, c, c - d * 0.08, Math.round(d * 0.62), (x, y) => r.part(circle(x, y, d * 0.03), dome(x, y, d * 0.03, d * 0.03, d * 0.03, 3.6), metal(GOLD, { polish: 0.9 }), { line: 0.7 }));
    r.part(circle(c, c, c * 0.7), pillow(2.2, c * 0.5, 1.6), enamel(hue), { line: true });
    return r.url({ shadow: { dy: 2, blur: 3, a: 0.4 } });
  });
}

/**
 * A round button (fixed art, `d` units across plus a 4-unit shadow margin all round): a domed enamel or
 * brass coin in a knurled brass bezel. Show it at (d + 8) px with a -4 px margin.
 */
export function roundButton(d = 44, hue: BtnHue | 'brass' | 'walnut' = 'brass', down = false): string {
  return cached(`round10:${d}:${hue}:${down}`, () => {
    // [ui10] an octagonal push-plate: a brass bezel with a beaded edge, four screws, a raised square-cut face
    const m = 4, k = deviceK(3), r = new Real(d, d, k, m), c = d / 2, oc = (s: number) => s * 0.293;
    const bz = cutBox(0.5, 1, d - 1, d - 1, oc(d - 1));
    r.part(bz, bevel(3, 2), metal(BRASS_OLD, { polish: 0.6 }));
    milgrain(r, 2.1, 2.6, d - 4.2, d - 4.2, oc(d - 4.2), d / 14, 0, 0, 0.42);
    const face: Material = hue === 'brass' ? metal(GOLD, { polish: 0.8 }) : hue === 'walnut' ? wood('walnut', { along: 'x' }) : HUE[hue].mat === 'cloth' ? cloth('linen', HUE[hue].face) : enamel(HUE[hue].face);
    const press = down ? 1 : 0, fi = 4.4, fs = d - 2 * fi;
    const fc = cutBox(fi, fi - 0.5 + press, fs, fs, oc(fs));
    r.part(fc, (x, y, ins) => 4 + Math.min(2.4, ins * 0.6) + 0 * x * y, face, { line: 0.9 });
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

/** A thin picture-frame moulding: wood (with tiny rosettes), or polished brass / dark iron with corner rivets. */
export function thinFrame(kind: 'oak' | 'walnut' | 'brass' | 'iron' | 'gold', t = 7): Nine {
  if (kind === 'oak' || kind === 'walnut') return panelFrame(kind, t, { brass: false, gilt: false, r: 4, inner: 4, m: 5, corner: 'rosette' });
  const m = 5, sh = 4, c = 40, s = m + t + sh, W = 2 * (t + sh) + c;
  return nine(`thinm10:${kind}:${t}`, () => {
    const k = deviceK(3), r = new Real(W, W, k, m);
    const outer = cutBox(0, 0, W, W, 2.6), ring = subtract(outer, box(t, t, W - 2 * t, W - 2 * t, 0));
    const col = kind === 'iron' ? IRON : kind === 'gold' ? hex('#f0c45a') : GOLD;
    r.part(ring, (x, y) => { const u = clamp(-outer(x, y) / t); return 1 + 3.2 * Math.sin(u * Math.PI) ** 0.6; }, metal(col, { polish: kind === 'iron' ? 0.35 : 0.8 }));
    for (const [x, y] of [[t / 2, t / 2], [W - t / 2, t / 2], [t / 2, W - t / 2], [W - t / 2, W - t / 2]]) rivet(r, x, y, Math.min(1.5, t * 0.22), 3.8, kind === 'iron' ? hex('#8a8e96') : BRASS_OLD);
    const cv = r.canvas({ shadow: { dy: 2, blur: 4, a: 0.4 } });
    innerShadow(cv, k, m + t, m + t, W - 2 * t, W - 2 * t, sh, 0.4);
    return { url: toURL(cv, 0.92), s: [s, s, s, s], o: m, bw: [t, t, t, t], fill: false, k };
  });
}

/** A carved sign board (filled): notched corners, a chamfered raised field, four brass rosette screws. */
export function signBoard(kind: WoodName = 'walnut'): Nine {
  const m = 5, W = 96, H = 44, b = 10;
  return nine(`sign10:${kind}`, () => {
    const k = deviceK(3), r = new Real(W, H, k, m);
    const sh = notched(0, 0, W, H, 4.2);
    r.part(sh, bevel(4, 3.5), wood(kind, { along: 'x', oy: 120 }));
    const fld = notched(4.4, 4.4, W - 8.8, H - 8.8, 3.4);
    r.carve(subtract(fld, offset(fld, -0.9)), 0.9, 0.9);
    r.line(fld, 0.7, 0.3);
    for (const [x, y] of [[6.6, 6.6], [W - 6.6, 6.6], [6.6, H - 6.6], [W - 6.6, H - 6.6]]) {
      r.part(circle(x, y, 2.3), dome(x, y, 2.3, 2.3, 0.8, 4.2), metal(BRASS_OLD, { polish: 0.55 }), { line: 0.8 });
      screw(r, x, y, 1.3, x * 0.1, 4.6);
    }
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

/** A tooled leather frame: stitched in cream thread, a gilt fillet, brass corner pieces; the opening is clear. */
export function leatherFrame(hue: string = '#2c6b43', t = 14): Nine {
  const m = 6, sh = 5, c = 40, L = t + 6, cs = Math.max(t + sh, L + 2), s = m + cs, W = 2 * cs + c;
  return nine(`lthf10:${hue}:${t}`, () => {
    const k = deviceK(3), r = new Real(W, W, k, m);
    const outer = cutBox(0, 0, W, W, 3), open = box(t, t, W - 2 * t, W - 2 * t, 0);
    r.part(subtract(outer, open), (x, y) => { const d = -outer(x, y); return 2 + 2.6 * Math.sqrt(clamp(d / 4)) - (d > t - 2 ? (d - (t - 2)) * 0.8 : 0); }, tileable(leather(hue, { scale: 2 }), cs, c, cs, c));
    stitches(r, 3.4, 3.4, W - 6.8, W - 6.8, 1.2, c / 10, cs, cs, THREAD.cream, { th: 0.5 });
    const gf = subtract(box(t - 4.6, t - 4.6, W - 2 * t + 9.2, W - 2 * t + 9.2, 0), box(t - 3.6, t - 3.6, W - 2 * t + 7.2, W - 2 * t + 7.2, 0));
    r.paint(gf, tileable(metal(GOLD, { polish: 0.7 }), cs, c, cs, c));
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, W, 1, -1], [W, W, -1, -1]] as [number, number, number, number][]) filigreeCorner(r, cx + sx * 0.3, cy + sy * 0.3, sx, sy, L, 5, BRASS_OLD, t * 0.42);
    const cv = r.canvas({ shadow: { dy: 3, blur: 6, a: 0.42 } });
    innerShadow(cv, k, m + t, m + t, W - 2 * t, W - 2 * t, sh, 0.42);
    return { url: toURL(cv, 0.92), s: [s, s, s, s], o: m, bw: [t, t, t, t], fill: false, k, rep: 'round' };
  });
}

/**
 * [ui10] A paper card's edge (opening clear: the CSS paper tile shows inside): a deckled, slightly aged edge, a
 * printed double rule with small fleurons at its corners, optionally a gilt edge. Painted unlit so it meets the
 * CSS paper inside without a seam; the edges tile (`round`) with periodic noise.
 */
export function paperCard(o: { gilt?: boolean; tint?: RGB; rule?: boolean } = {}): Nine {
  const m = 6, bw = 10, cs = 16, c = 64, W = 2 * cs + c;
  return nine(`pcard10:${o.gilt}:${o.tint?.join()}:${o.rule}`, () => {
    const k = deviceK(3), r = new Real(W, W, k, m);
    const f1 = 8 / c, f2 = 40 / c;
    const base = box(0.6, 0.6, W - 1.2, W - 1.2, 0);
    const deckle: SDF = (x, y) => base(x, y) + (pnoise(x * f1, y * f1, 8, 8, 3) - 0.5) * 1.5 + (pnoise(x * f2, y * f2, 40, 40, 7) - 0.5) * 0.75;
    deckle.bb = [-1.5, -1.5, W + 1.5, W + 1.5];
    const tint = o.tint ?? [255, 255, 255];
    const raw = texAlb('paper', { scale: 1.6, tint });
    // the paper's fibres without its blotches (so the tiled middle never shows a seam): mean + high-pass
    const mean: RGB = [0, 0, 0];
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { const a = raw(i * 13.3, j * 13.3); mean[0] += a[0] / 576; mean[1] += a[1] / 576; mean[2] += a[2] / 576; }
    const pap = (x: number, y: number): RGB => {
      const a = raw(x, y), b1 = raw(x - 5, y - 5), b2 = raw(x + 5, y - 5), b3 = raw(x - 5, y + 5), b4 = raw(x + 5, y + 5);
      return [mean[0] + (a[0] - (b1[0] + b2[0] + b3[0] + b4[0]) / 4) * 0.9, mean[1] + (a[1] - (b1[1] + b2[1] + b3[1] + b4[1]) / 4) * 0.9, mean[2] + (a[2] - (b1[2] + b2[2] + b3[2] + b4[2]) / 4) * 0.9];
    };
    const gold: RGB = [214, 164, 70];
    const alb = (x: number, y: number): RGB => {
      const d = -deckle(x, y), a = pap(x, y);
      const aged = mix(a, [a[0] * 0.86, a[1] * 0.74, a[2] * 0.58] as RGB, (1 - clamp(d / 3.2)) * 0.55);
      if (o.gilt && d < 1.1) return mix(aged, gold, 0.85 * (1 - clamp((d - 0.6) / 0.5)));
      return aged;
    };
    r.part(deckle, 1, tileable({ alb, spec: 0, shin: 1 }, cs, c, cs, c));
    if (o.rule !== false) {
      const rr = (a: number, w: number) => subtract(box(a, a, W - 2 * a, W - 2 * a, 0), box(a + w, a + w, W - 2 * (a + w), W - 2 * (a + w), 0));
      r.inkFill(rr(3.6, 0.32), 0.5);
      r.inkFill(rr(4.9, 0.62), 0.42);
      // a small fleuron where the rules turn: a diamond and four dots
      for (const [x, y] of [[4.2, 4.2], [W - 4.2, 4.2], [4.2, W - 4.2], [W - 4.2, W - 4.2]]) {
        r.inkFill(polygon([[x, y - 2.1], [x + 2.1, y], [x, y + 2.1], [x - 2.1, y]]), 0.55);
        r.paint(polygon([[x, y - 0.9], [x + 0.9, y], [x, y + 0.9], [x - 0.9, y]]), { alb: pap }, 1);
      }
    }
    const cv = r.canvas({ shadow: false, flat: true });
    return { url: toURL(cv, 0.93), s: [m + cs, m + cs, m + cs, m + cs], o: m, bw: [bw, bw, bw, bw], fill: true, k, rep: 'round' };
  });
}

/** [ui10] A carved cartouche crest that sits on a cabinet's top rail: C-scrolls, acanthus and a gilt boss (w x h). */
export function crestArt(w = 96, h = 36, kind: WoodName = 'walnut'): string {
  return cached(`crest10b:${w}x${h}:${kind}`, () => {
    const k = deviceK(3), r = new Real(w, h, k, 4), cx = w / 2, cy = h * 0.5;
    const leafM = (i: number) => ({ ...wood('oak', { along: 'x', oy: 40 + i * 70 }), alb: ((a) => (x: number, y: number) => { const c = a(x, y); return [c[0] * 0.78, c[1] * 0.86, c[2] * 0.5] as RGB; })(wood('oak', { along: 'x', oy: 40 + i * 70 }).alb) });
    // oak sprays to each side: two leaves and an acorn
    for (const s of [-1, 1]) {
      for (const [dy, a, L, i] of [[-0.12, -0.32, 0.36, 0], [0.16, 0.26, 0.32, 1]] as [number, number, number, number][]) {
        const ang = s > 0 ? a : Math.PI - a, x0 = cx + s * h * 0.36, y0 = cy + dy * h;
        const lf = oakLeaf(x0, y0, w * L, ang);
        r.part(lf, (_x, _y, ins) => 2 + Math.min(1.6, ins * 0.9), leafM(i + (s > 0 ? 2 : 0)), { line: true });
        const c = Math.cos(ang), sn = Math.sin(ang);
        r.carve(segment(x0, y0, x0 + c * w * L * 0.85, y0 + sn * w * L * 0.85, 0.32), 0.6, 0.3);
      }
      const [cup, nut] = acornShapes(cx + s * w * 0.3, cy + h * 0.44, h * 0.42);
      r.part(nut, (_x, _y, ins) => 3 + Math.min(2, ins * 0.8), { ...wood('honey', { along: 'y', ox: 30 }), spec: 0.4, shin: 30, coat: 0.6 }, { line: true });
      r.part(cup, (_x, _y, ins) => 3.6 + Math.min(1.6, ins * 0.8), cloth('felt', hex('#7a5430'), { scale: 5, amt: 1.2 }), { line: true });
    }
    // the carved shield, and on it a gilt boss with the owl crest in relief
    const sh = polygon([[cx - h * 0.4, 1.2], [cx + h * 0.4, 1.2], [cx + h * 0.4, h * 0.56], [cx, h - 0.8], [cx - h * 0.4, h * 0.56]]);
    r.part(sh, (_x, _y, ins) => 3 + Math.min(2.4, ins * 0.7), wood(kind, { along: 'y', ox: 120 }), { line: true });
    r.carve(subtract(offset(sh, -2), offset(sh, -2.6)), 0.6, 0.3);
    const br = h * 0.3;
    r.part(circle(cx, cy - h * 0.04, br), (x, y) => 5.4 + dome(cx, cy - h * 0.04, br, br, 1.4)(x, y, 0), metal(GOLD, { polish: 0.8 }), { line: true });
    owlCrest(r, cx, cy - h * 0.02, br * 0.72, 0.7);
    return r.url({ shadow: { dy: 2.5, blur: 3.5, a: 0.45 } });
  });
}

/**
 * [ui10] A slider's carved walnut track as a 9-slice (14-unit end caps with brass pins, a seamless 32-unit
 * middle with a dark slot and scale ticks), 14 units tall: `border-image` it with `round`.
 */
export function sliderTrack(): Nine {
  return nine('sltrack10', () => {
    const H = 14, e = 14, c = 32, W = 2 * e + c, m = 2, k = deviceK(3), r = new Real(W, H, k, m);
    r.part(cutBox(0.5, 1, W - 1, H - 2, 3.5), bevel(3, 2.4), tileable(wood('walnut', { along: 'x', oy: 40 }), e, c));
    const slot = box(6.5, 5.2, W - 13, 3.6, 0);
    r.part(slot, (_x, y) => 1.2 - 1.2 * Math.sqrt(Math.max(0, 1 - ((y - 7) / 1.8) ** 2)), matte('#1c120c'), { line: 0.8 });
    for (const x of [3.6, W - 3.6]) rivet(r, x, 7, 1.25, 3.2, GOLD, 0.8);
    for (let x = e + 4; x < W - 6; x += 8) if (x < e + c) { for (const xx of [x, x - c, x + c]) if (xx > 7 && xx < W - 7) { r.carve(segment(xx, 2.2, xx, 3.8, 0.2), 0.4, 0.2); r.carve(segment(xx, 10.2, xx, 11.8, 0.2), 0.4, 0.2); } }
    const cv = r.canvas({ shadow: { dy: 1, blur: 1.5, a: 0.3 } });
    return { url: toURL(cv, 0.93), s: [m, e + m, m, e + m], o: m, bw: [0, e, 0, e], fill: true, k, rep: 'round' };
  });
}
/** [ui10] the slider's brass lever: a bevel-cut brass grip (w x h units) with knurled ribs and an ivory index line */
export function sliderKnob(w = 20, h = 30): string {
  return cached(`slknob10:${w}x${h}`, () => {
    const k = deviceK(3), r = new Real(w, h, k, 3), cx = w / 2;
    const grip = cutBox(0.5, 0.5, w - 1, h - 1, 4);
    r.part(grip, (x, y, ins) => 1 + Math.min(3.2, ins * 1.1) + 0 * x * y, metal(GOLD, { polish: 0.8, along: 'y' }), { line: true });
    // knurled ribs above and below the index
    for (const y0 of [4.2, h - 4.2 - 6.6]) for (let i = 0; i < 4; i++) { const y = y0 + i * 2.2; r.carve(box(4.2, y, w - 8.4, 0.6, 0), 0.6, 0.3); }
    const idx = cutBox(cx - 5.2, h / 2 - 2.4, 10.4, 4.8, 1.6);
    r.part(idx, (_x, _y, ins) => 3.6 + Math.min(0.8, ins * 0.6), { alb: () => hex('#f4ead2'), spec: 0.6, shin: 50, coat: 0.8 }, { line: 0.9 });
    r.inkFill(box(cx - 3.6, h / 2 - 0.35, 7.2, 0.7, 0), 0.8);
    return r.url({ shadow: { dy: 2, blur: 3, a: 0.45 } });
  });
}

/** [ui10] A toggle switch plate (w x h units): a walnut base with a brass escutcheon and its slot, green when on. */
export function switchPlate(on: boolean, w = 58, h = 30): string {
  return cached(`swplate10:${on}:${w}x${h}`, () => {
    const k = deviceK(3), r = new Real(w, h, k, 3);
    r.part(cutBox(0, 0, w, h, 6), bevel(3.4, 3), wood('walnut', { along: 'x', oy: 90 }));
    const esc = cutBox(5, h / 2 - 6.5, w - 10, 13, 3.6);
    r.part(esc, bevel(1.8, 1.4, 3.4), metal(BRASS_OLD, { polish: 0.65 }), { line: 0.9 });
    const slot = box(9, h / 2 - 3, w - 18, 6, 0);
    r.part(slot, 3.4, on ? { ...enamel(hex('#3aa860')), emit: 0 } : matte('#1a100a'), { line: 0.9 });
    if (on) r.paint(box(11, h / 2 - 2.2, w - 22, 1.2, 0), glow([210, 255, 220]), 0.45);
    for (const x of [7, w - 7]) { r.part(circle(x, h / 2, 0.9), dome(x, h / 2, 0.9, 0.9, 0.7, 5), metal(BRASS_OLD, { polish: 0.7 }), { line: 0.6 }); }
    return r.url({ shadow: false });
  });
}
/** [ui10] the toggle's lever head: a bevel-cut brass cap with a beaded edge and an ivory enamel top (d units) */
export function switchLever(d = 26): string {
  return cached(`swlever10:${d}`, () => {
    const k = deviceK(3), r = new Real(d, d, k, 3), c = d / 2;
    const cap = cutBox(0.4, 0.4, d - 0.8, d - 0.8, 5.5);
    r.part(cap, (x, y, ins) => 1 + Math.min(3.4, ins * 1.1) + 0 * x * y, metal(GOLD, { polish: 0.8 }), { line: true });
    milgrain(r, 1.6, 1.6, d - 3.2, d - 3.2, 4.8, d / 10, 0, 0, 0.38);
    const top = cutBox(c - d * 0.3, c - d * 0.3, d * 0.6, d * 0.6, 2.6);
    r.part(top, (x, y, ins) => 4.6 + Math.min(1.6, ins * 0.7) + 0 * x * y, { alb: () => hex('#f6eedb'), spec: 0.7, shin: 60, coat: 1 }, { line: 0.9 });
    return r.url({ shadow: { dy: 2, blur: 3, a: 0.5 } });
  });
}

void INK; void ellipse; void alongRect; void carvedCorner; void rosette;
// ------------------------------------------------------------------ registry and CSS

/** Every named frame (the old pixel frame names map onto these). */
export const NINE: Record<string, () => Nine> = {
  wood: () => panelFrame('oak', 12, { brass: false, r: 10, inner: 6, m: 8 }),
  wood_dark: () => panelFrame('walnut', 12, { brass: false, r: 10, inner: 6, m: 8 }),
  walnut: () => panelFrame('walnut', 16, { r: 14 }),
  walnut_thin: () => panelFrame('walnut', 10, { brass: false, r: 9, inner: 5, m: 7 }),
  ebony: () => panelFrame('ebony', 14, { r: 12, corner: 'gold' }),
  oak_panel: () => panelFrame('oak', 14, { r: 12, corner: 'carved' }),
  paper_card: () => paperCard(), paper_card_gilt: () => paperCard({ gilt: true }),
  slider_track: () => sliderTrack(),
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
/** [ui10] a paper card: the seamless CSS paper tile inside a painted deckled, printed edge (paperCard) */
export const paperCardCSS = (gilt = false) => `${nineCSS(gilt ? 'paper_card_gilt' : 'paper_card')};background:none;border-radius:0;box-shadow:none`;
/** Paper surfaces are plain CSS (a seamless paper tile, square corners, soft shadows): they keep their texture at any size. */
export const SURFACE_CSS: Record<string, string> = {
  parchment_dark: 'border:10px solid transparent;border-image:none;border-radius:0;background:var(--tx-paper-dark) 0 0/320px 320px,#dcc89c;background-clip:border-box;box-shadow:inset 0 2px 5px rgba(60,36,14,.38),inset 0 0 0 1px rgba(90,60,30,.25),0 1px 0 rgba(255,248,230,.6)',
  paper_ledger: 'border:8px solid transparent;border-image:none;border-radius:0;background:repeating-linear-gradient(180deg,transparent 0 21px,rgba(70,110,170,.22) 21px 22px) 0 6px,linear-gradient(90deg,transparent 0 22px,rgba(196,72,72,.38) 22px 23.5px,transparent 23.5px),var(--tx-paper) 0 0/320px 320px,#f6ecd4;background-clip:border-box;box-shadow:var(--sh-1),inset 0 1px 0 rgba(255,255,255,.6)',
  crt: 'border:8px solid transparent;border-image:none;border-radius:0;background:radial-gradient(ellipse at 40% 30%,#2a3a4a,#0c1218);box-shadow:0 0 0 3px #3a3c44,0 0 0 5px #1a1b20,var(--sh-2),inset 0 0 18px rgba(120,200,255,.18)',
};

export function nineCSS(name: string, o: { fill?: boolean; bw?: number[] | false } = {}): string {
  if (SURFACE_CSS[name]) return SURFACE_CSS[name];
  if (name === 'parchment') return paperCardCSS();
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
