// Voxel models for the interview room: Pip's office inside the oak (curved heartwood walls, a
// round window, the desk with its drawer, brass lamp, inkwell, books, a cork board, a ticking wall
// clock) and the little props that pop in while Pip acts out your answers (a bed with a fluffy
// pillow, sheep and a fence, a phone, mugs, a microphone, a radio...). Measured in px, 16 px = 1
// block, every model resting on y = 0 and centred on x/z unless noted.
import * as THREE from 'three';
import { assemble, box, lean, makeMaterials, type BoxSpec, type Painter } from '../gfx/box.ts';
import { ramp, tone } from '../gfx/color.ts';
import { bark, cloth, flat, lamp, leaves, lvl, metal, R, smooth, solid, wood } from '../gfx/mats.ts';
import { fbm, hash } from '../gfx/noise.ts';

/** Build one mesh from boxes (texture density in texels per px). */
export function mesh(boxes: BoxSpec[], density = 1, shadows = true): THREE.Mesh {
  const asm = assemble([{ boxes }], { density });
  const { mats } = makeMaterials(asm.tex);
  const m = new THREE.Mesh(asm.geos[0], mats);
  m.castShadow = shadows; m.receiveShadow = true;
  m.userData.dispose = () => { asm.geos[0].dispose(); asm.tex.dispose(); mats.forEach((x) => x.dispose()); };
  return m;
}

// ------------------------------------------------------------------ materials

const W = { oak: '#b87a41', dark: '#7b4b2c', honey: '#d39a5a', red: '#a8503a', walnut: '#6a4428' };
const wx = (c: string, plank = 3, seed = 0) => wood(c, { axis: 'x', plank, seed });
const wy = (c: string, plank = 0, seed = 0) => wood(c, { axis: 'y', plank, seed });
const wz = (c: string, plank = 3, seed = 0) => wood(c, { axis: 'z', plank, seed });
const brass = metal('#c9a14a');
const steel = metal('#9aa2b4');
const paper = (c = '#f6efdc'): Painter => solid(c, { noise: 0.25, speck: 0.2, rim: 0.4 });
const book = (c: string): Painter => {
  const r = R(c), page = R('#f6efdc'), gold = R('#e8c25a');
  return (t) => {
    if (t.face === 4 || t.face === 0) return tone(page, t.v % 2 ? 0.3 : -0.6);
    const L = lvl(t, { noise: 0.2 });
    if (t.face === 1 && (t.u === 1 || t.u === t.w - 2) && t.h > 3) return tone(gold, 0.4);
    if (t.face === 1 && t.v > 0 && t.v < t.h - 1 && (t.u === 2 || t.u === t.w - 3)) return tone(r, L - 1);
    return tone(r, L);
  };
};

/** Carved heartwood seen from inside the hollow: soft vertical grain, a wainscot band and a rail. */
function heartwood(R0: number): Painter {
  const inner = R('#c58a52'), wain = R('#8a5a34'), rings = ramp(0xd9a865), dark = ramp(0x7a4a28);
  const barkP = bark('#7a5434', { seed: 5, moss: '#5f9a3e', mossTo: 26 });
  return (t) => {
    const d = Math.hypot(t.x, t.z);
    if (t.face === 2) return d > R0 + 6 ? tone(dark, -0.3) : tone(rings, (Math.floor(d / 1.6) % 2 ? -0.7 : 0.35) + (hash(Math.floor(t.x * 2), 1, Math.floor(t.z * 2), 3) - 0.5) * 0.5);
    if (t.face === 3) return tone(wain, -1.2);
    if (d > R0 + 3) return barkP(t);
    const along = Math.atan2(t.x, -t.z) * R0;
    let L = (fbm(along / 6, t.y / 22, 3, 7) - 0.5) * 1.8 + (Math.floor(along / 2.2) % 5 === 0 ? -0.5 : 0);
    if (t.y < 18) return tone(wain, L * 0.7 + (Math.floor(along / 4) % 2 ? -0.3 : 0.2) + (t.y > 16.6 ? 1.2 : 0) + (t.y < 1.5 ? -0.8 : 0));
    if (t.y < 19.4) return tone(inner, 1.6);
    L += (t.y - 50) * 0.008;
    // the odd knot hole and carved notch
    if (hash(Math.floor(along / 9), Math.floor(t.y / 9), 0, 11) > 0.96) L -= 1.2;
    return tone(inner, L);
  };
}

// ------------------------------------------------------------------ the room shell

export const ROOM = { R: 100, H: 92, A0: -84, A1: 84 };

/** Curved back wall (an arc of segments), the floor slice of the trunk and the ceiling. */
export function shell(): BoxSpec[] {
  const out: BoxSpec[] = [], { R: Rr, H, A0, A1 } = ROOM, T = 10, n = 26;
  const hw = heartwood(Rr);
  const step = (A1 - A0) / n;
  for (let i = 0; i < n; i++) {
    const a = A0 + step * (i + 0.5), r = (a * Math.PI) / 180;
    const len = ((2 * Math.PI * (Rr + T / 2)) * step) / 360 + 1.2;
    const cx = Math.sin(r) * (Rr + T / 2), cz = -Math.cos(r) * (Rr + T / 2);
    out.push({ ...box(cx, -8, cz, len, H + 8, T, hw), rot: [0, -a, 0], pivot: [cx, 0, cz] });
  }
  // the floor: a thick slice of the trunk, planks on top, growth rings on the cut edge
  const fl = wood('#c08550', { axis: 'x', plank: 4, seed: 2 });
  const ringP = (): Painter => {
    const r = ramp(0xd9a865), b = bark('#6e4c30', { seed: 3, moss: '#5f9a3e', mossTo: 4 });
    return (t) => {
      const d = Math.hypot(t.x, t.z);
      if (t.face === 2) return fl(t);
      if (d > Rr + 4) return b(t);
      return tone(r, (Math.floor(d / 1.8) % 2 ? -0.6 : 0.3) + (hash(Math.floor(t.x), Math.floor(t.y), Math.floor(t.z), 2) - 0.5) * 0.6 - (t.y < -6 ? 0.8 : 0));
    };
  };
  const rp = ringP();
  for (let z = -Rr - 8; z < Rr + 8; z += 8) {
    const zc = z + 4, half = Math.sqrt(Math.max(0, (Rr + 9) ** 2 - zc * zc));
    if (half < 6) continue;
    out.push(box(0, -10, zc, half * 2, 10, 8, rp));
  }
  // ceiling with two beams
  const ceil = wood('#8a5a34', { axis: 'x', plank: 4 });
  out.push(box(0, H - 2, -30, 2 * Rr + 20, 6, 150, ceil, { skip: 'u' }));
  for (const x of [-34, 34]) out.push(box(x, H - 8, -30, 8, 6, 150, wz('#6a4428', 0)));
  return out;
}

/** A thick ring of bark around the cut front edge, framing the shot like a proscenium. */
export function frontArch(): BoxSpec[] {
  const out: BoxSpec[] = [], b = bark('#7a5434', { seed: 9, moss: '#5f9a3e', mossTo: 30 });
  const ringcut = ramp(0xd9a865);
  const P: Painter = (t) => (t.face === 4 ? tone(ringcut, (Math.floor((Math.abs(t.x) + t.y) / 2) % 2 ? -0.5 : 0.4)) : b(t));
  for (const sd of [-1, 1]) {
    const x = sd * (ROOM.R + 4);
    out.push(box(x, -10, 0, 16, ROOM.H + 22, 18, P));
    out.push(lean(box(x - sd * 6, ROOM.H - 6, 0, 18, 12, 16, P), 0, 0, -sd * 30));
  }
  return out;
}

// ------------------------------------------------------------------ furniture

export const DESK = { w: 62, d: 24, h: 17, z: -40, drawerX: 24 };

export function desk(): BoxSpec[] {
  const { w, d, h, drawerX } = DESK, top = wx(W.oak, 4, 1), side = wy(W.dark), front = wx('#9a6236', 0, 3), panel = wx('#a86d3a', 0, 5);
  const out: BoxSpec[] = [];
  out.push(box(0, h - 2, 0, w + 3, 2, d + 3, top));
  out.push(box(0, h - 3, 0, w, 1, d, wx(W.dark)));
  // left pedestal: a cupboard with a raised panel and a brass knob
  out.push(box(-drawerX, 0, 0, 14, h - 3, d, side));
  out.push(box(-drawerX, 2, d / 2 + 0.3, 10, h - 7, 0.6, panel), box(-drawerX + 3.5, 7, d / 2 + 0.7, 1.2, 1.2, 0.8, brass));
  // right pedestal: a cupboard below and an open slot above for the drawer
  out.push(box(drawerX, 0, 0, 14, h - 10, d, side));
  out.push(box(drawerX, 2, d / 2 + 0.3, 10, h - 14, 0.6, panel));
  out.push(box(drawerX - 6.5, h - 10, 0, 1, 7, d, side), box(drawerX + 6.5, h - 10, 0, 1, 7, d, side), box(drawerX, h - 10, -d / 2 + 0.5, 12, 7, 1, side));
  out.push(box(drawerX, h - 10, -0.5, 12, 0.6, d - 1, flat('#2a1a10')), box(drawerX, h - 9.4, -d / 2 + 1.1, 12, 6.4, 0.3, flat('#1e120a')));
  for (const sx of [-1, 1]) out.push(box(sx * drawerX, 0, 0, 15, 1.4, d + 1, wx(W.walnut)));
  // a modesty panel at the back so the stool stays hidden
  out.push(box(0, 4, -d / 2 + 1, w - 26, h - 7, 1.5, front));
  return out;
}

/** The drawer, in its own model so it can slide open: origin at its front-bottom centre. */
export function drawer(): BoxSpec[] {
  const f = wx('#a86d3a', 0, 7);
  return [
    box(0, 0, -10.5, 11, 1, 20, wx('#8a5a34')), box(-5, 0, -10.5, 1, 4.5, 20, f), box(5, 0, -10.5, 1, 4.5, 20, f), box(0, 0, -20, 11, 4.5, 1, f),
    box(0, -0.4, -0.2, 12, 6.2, 1.4, f), box(0, 2.2, 0.8, 4, 1, 1, brass),
  ];
}

export function stool(): BoxSpec[] {
  const out = [box(0, 13, 0, 14, 2, 14, wx('#c98a4a', 0)), box(0, 14.5, 0, 12, 1.2, 12, cloth('#b84a3b', { check: '#d9785a' })), box(0, 5, 0, 12, 1.2, 12, wx('#a86d38', 0))];
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) out.push(box(x, 0, z, 2, 13, 2, wy(W.dark)));
  return out;
}

export function deskLamp(): { boxes: BoxSpec[]; bulb: [number, number, number] } {
  // a banker's lamp: brass foot and stem, a green glass shade glowing underneath
  const shade = smooth('#2f8a52');
  const boxes: BoxSpec[] = [
    box(0, 0, 0, 9, 1.4, 6, brass), box(0, 1.4, 0, 6, 1, 4, brass), box(0, 2.4, 0, 1.4, 9, 1.4, brass),
    box(0, 10.5, 1.2, 1.2, 1.2, 3, brass),
    box(0, 11, 2.2, 13, 3, 5, shade), box(0, 13.6, 2.2, 11, 1.2, 4, shade),
    box(0, 10.6, 2.2, 11, 0.5, 4, lamp('#fff2b8'), { glow: true }),
    box(3.4, 3.4, 1.6, 0.5, 4, 0.5, flat('#d8b048')), box(3.4, 3, 1.6, 1, 1, 1, brass),
  ];
  return { boxes, bulb: [0, 10, 2.2] };
}

export function inkwell(): BoxSpec[] {
  const glass = smooth('#2a3a6a');
  return [
    box(0, 0, 0, 5, 3, 5, glass), box(0, 3, 0, 3, 1.5, 3, glass), box(0, 4.5, 0, 3.6, 0.8, 3.6, brass),
    // a quill: white vane, dark tip, leaning out of the pot
    { ...box(0, 4, 0, 0.8, 12, 0.8, flat('#e8e0d0')), rot: [0, 0, -22], pivot: [0, 4, 0] },
    { ...box(1.6, 8, 0, 2.6, 8, 0.6, solid('#f6f1e6', { noise: 0.3 })), rot: [0, 0, -22], pivot: [0, 4, 0] },
  ];
}

export function bookStack(seed = 1): BoxSpec[] {
  const cols = ['#7a2e3a', '#2e5a7a', '#3f7a42', '#a8703f', '#5a3a7a', '#b8892e'];
  const out: BoxSpec[] = [];
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const w = 12 - (i % 2) * 2 + Math.floor(hash(i, seed, 1) * 3), d = 9 - (i % 3), h = 2 + (i % 2);
    out.push({ ...box(0, y, 0, w, h, d, book(cols[(i + seed) % cols.length])), rot: [0, (hash(i, seed, 2) - 0.5) * 24, 0], pivot: [0, y, 0] });
    y += h;
  }
  return out;
}

export function standingBooks(n: number, seed = 3): BoxSpec[] {
  const cols = ['#7a2e3a', '#2e5a7a', '#3f7a42', '#a8703f', '#5a3a7a', '#b8892e', '#2e6a6a'];
  const out: BoxSpec[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = 2 + (hash(i, seed, 1) > 0.6 ? 1 : 0), h = 9 + Math.floor(hash(i, seed, 2) * 4);
    const tilt = i === n - 1 ? -14 : 0;
    out.push(lean(box(x, 0, 0, w, h, 8, book(cols[Math.floor(hash(i, seed, 3) * cols.length)])), 0, 0, tilt));
    x += w + 0.2;
  }
  return out;
}

export function candle(): BoxSpec[] {
  return [box(0, 0, 0, 5, 1, 5, brass), box(0, 1, 0, 2.4, 5, 2.4, smooth('#f3e6c8')), box(0, 6, 0, 1.2, 2, 1.2, lamp('#ffd36a'), { glow: true })];
}

export function teacup(): BoxSpec[] {
  const p = smooth('#f2ede2');
  return [box(0, 0, 0, 7, 0.8, 7, p), box(0, 0.8, 0, 4.4, 3, 4.4, p), box(0, 3.4, 0, 3.4, 0.4, 3.4, flat('#8a4a2a')), box(3, 1.6, 0, 1.4, 1.6, 1, p)];
}

export function paperStack(): BoxSpec[] {
  return [lean(box(0, 0, 0, 11, 1.4, 14, paper()), 0, 6, 0), lean(box(1, 1.4, 0, 11, 0.6, 14, paper('#fbf6e8')), 0, -5, 0)];
}

/** Brass-rimmed name plate on a little wooden wedge; the name itself is a canvas texture. */
export function nameplate(): BoxSpec[] {
  return [box(0, 0, 0, 22, 1.2, 5, wx(W.walnut)), { ...box(0, 0.8, 0, 21, 3.4, 1.2, wx('#5a3a24')), rot: [-20, 0, 0], pivot: [0, 0.8, 0] }];
}

export function clockBody(): BoxSpec[] {
  const out: BoxSpec[] = [], rim = wx('#7b4b2c', 0, 2), face = solid('#f6ecd2', { noise: 0.2, rim: 0 });
  // stepped round rim
  const rows = [[-9, 8], [-8, 12], [-7, 14], [-5, 16], [-3, 18], [3, 18]];
  for (let r = 0; r < 19; r++) {
    const y = r - 9, w = 2 * Math.round(Math.sqrt(Math.max(0, 9.6 * 9.6 - y * y)));
    if (w > 0) out.push(box(0, r, 0, w, 1, 3, rim));
  }
  void rows;
  for (let r = 1; r < 18; r++) {
    const y = r - 9, w = 2 * Math.round(Math.sqrt(Math.max(0, 7.6 * 7.6 - y * y)));
    if (w > 0) out.push(box(0, r, 1.6, w, 1, 0.4, face));
  }
  // hour pips
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, big = k % 3 === 0;
    out.push(box(Math.sin(a) * 6.2, 9 + Math.cos(a) * 6.2 - 0.5, 1.9, big ? 1.4 : 0.8, big ? 1.4 : 0.8, 0.3, flat('#3b2414')));
  }
  // a little carved owl crest and a pendulum case below
  out.push(box(0, 18.5, 0, 6, 3, 3, rim), box(-2.5, 21, 0, 1.4, 1.6, 2, rim), box(2.5, 21, 0, 1.4, 1.6, 2, rim));
  out.push(box(0, -16, 0.5, 10, 16, 2, wy('#6a4428')), box(0, -15, 1.6, 7, 13, 0.4, flat('#2a1a10')));
  out.push(box(0, 8.6, 2.1, 1.2, 1.2, 0.4, brass));
  return out;
}
export const clockHand = (len: number, w: number): BoxSpec[] => [box(0, -1, 0, w, len + 1, 0.4, flat('#2a1a14')), box(0, len - 1.5, 0, w + 0.6, 1.5, 0.4, flat('#2a1a14'))];
export const pendulum = (): BoxSpec[] => [box(0, -11, 0, 0.6, 11, 0.4, brass), box(0, -13.5, 0, 3.6, 3.6, 0.6, brass)];

export function windowFrame(r: number): BoxSpec[] {
  const out: BoxSpec[] = [], f = wy('#7b4b2c', 0, 4), sill = wx('#9a6236', 0, 2);
  for (let i = 0; i < 2 * r + 4; i++) {
    const y = i - r - 2 + 0.5;
    const outer = Math.sqrt(Math.max(0, (r + 2) ** 2 - y * y)), inner = Math.sqrt(Math.max(0, r * r - y * y));
    if (outer <= 0) continue;
    if (inner <= 0.3) out.push(box(0, i - r - 2, 0, outer * 2, 1, 3, f));
    else for (const sd of [-1, 1]) { const w = outer - inner + 0.6; out.push(box(sd * (inner + w / 2 - 0.3), i - r - 2, 0, w, 1, 3, f)); }
  }
  out.push(box(0, -r, 0.5, 1.2, 2 * r, 1.2, f), box(0, -0.6, 0.5, 2 * r, 1.2, 1.2, f));
  out.push(box(0, -r - 4, 2.5, 2 * r + 10, 2, 7, sill));
  // a little potted succulent on the sill
  out.push(box(-r + 1, -r - 2, 3, 4, 3, 4, solid('#c9683f', { noise: 0.4 })), box(-r + 1, -r + 1, 3, 3, 2, 3, leaves('#6aa84a', { seed: 2 })), box(-r + 1, -r + 3, 3, 1.6, 1.6, 1.6, leaves('#86c05a', { seed: 4 })));
  return out;
}

export function corkBoard(): BoxSpec[] {
  const cork: Painter = (t) => tone(R('#b68b4f'), lvl(t, { noise: 1.4, scale: 1.2, rim: 0.2 }) + (hash(Math.floor(t.x * 2), Math.floor(t.y * 2), 0, 4) > 0.8 ? -1 : 0));
  const fr = wx('#6a4428', 0, 6);
  const out: BoxSpec[] = [box(0, 0, 0, 36, 24, 1.6, cork)];
  out.push(box(0, -1.5, 0.6, 38, 1.6, 2.6, fr), box(0, 23.8, 0.6, 38, 1.6, 2.6, fr), box(-18.8, -1.5, 0.6, 1.6, 27, 2.6, fr), box(18.8, -1.5, 0.6, 1.6, 27, 2.6, fr));
  // pinned notes: a sticky, a moon chart, a sleep log grid, a photo of a sheep
  const notes: [number, number, number, number, string, number][] = [[-11, 12, 9, 8, '#f9d856', -6], [0, 13, 10, 9, '#f6efdc', 3], [11, 11, 9, 10, '#cfe6f2', -4], [-8, 2, 11, 8, '#f6efdc', 5], [9, 2, 8, 7, '#f0a8b4', -8]];
  notes.forEach(([x, y, w, h, c, r], i) => {
    const P: Painter = (t) => {
      const base = solid(c, { noise: 0.2, rim: 0.3 })(t);
      if (t.face !== 4) return base;
      if (i === 1 && t.v > 1 && t.v < t.h - 2 && t.u > 1 && t.u < t.w - 2 && (t.u + t.v * 3) % 7 === 0) return 0x3a4a8a;
      if (i === 2 && ((t.u % 3 === 0 && t.v < t.h - 1) || t.v % 3 === 0)) return 0x7ea6d8;
      if (i === 3 && t.v % 2 === 0 && t.u > 0 && t.u < t.w - 1 && t.v < t.h - 2) return 0x8a8fa8;
      if (i === 4 && Math.hypot(t.u - t.w / 2, t.v - t.h / 2) < 2.4) return 0xffffff;
      return base;
    };
    out.push({ ...box(x, y - h / 2, 1.2, w, h, 0.4, P), rot: [0, 0, r], pivot: [x, y, 1.2] });
    out.push(box(x, y + h / 2 - 2, 1.8, 1.4, 1.4, 1.2, smooth(['#d9453b', '#3c88d8', '#46963c', '#ffcc34', '#d9453b'][i])));
  });
  // red string between two notes
  out.push({ ...box(-5.5, 10.8, 1.7, 12, 0.4, 0.3, flat('#c43a30')), rot: [0, 0, -10], pivot: [-5.5, 11, 1.7] });
  return out;
}

export function shelf(): BoxSpec[] {
  const f = wx('#8a5a34', 0, 3), side = wy('#6a4428');
  const out: BoxSpec[] = [box(-17, 0, 0, 2, 44, 12, side), box(17, 0, 0, 2, 44, 12, side), box(0, 0, -5.5, 34, 44, 1, wy('#5a3a24'))];
  for (const y of [0, 14, 28, 42]) out.push(box(0, y, 0, 34, 2, 12, f));
  const place = (b: BoxSpec[], dx: number, dy: number) => b.map((x) => ({ ...x, at: [x.at[0] + dx, x.at[1] + dy, x.at[2]] as [number, number, number], pivot: x.pivot ? [x.pivot[0] + dx, x.pivot[1] + dy, x.pivot[2]] as [number, number, number] : undefined }));
  out.push(...place(standingBooks(9, 1), -15, 2), ...place(standingBooks(7, 4), -15, 16), ...place(bookStack(2), 9, 16), ...place(standingBooks(10, 7), -14, 30));
  out.push(...place([box(0, 0, 0, 5, 5, 5, smooth('#4a8ab8')), box(0, 5, 0, 3, 2, 3, smooth('#4a8ab8'))], 10, 2));
  out.push(...place([box(0, 0, 0, 6, 4, 6, solid('#c9683f')), box(0, 4, 0, 7, 4, 7, leaves('#5a9a3e', { seed: 3 }))], 11, 30));
  return out;
}

export function fernPot(): BoxSpec[] {
  const out: BoxSpec[] = [box(0, 0, 0, 12, 10, 12, solid('#c9683f', { noise: 0.5 })), box(0, 9, 0, 13, 2, 13, solid('#b85a34')), box(0, 10, 0, 11, 1, 11, solid('#5c3d2a'))];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 360;
    out.push({ ...box(0, 10, 0, 3, 14, 1.5, leaves('#4c9b3b', { seed: i }), { sway: 1, cut: false }), rot: [28, a, 0], pivot: [0, 10, 0] });
  }
  return out;
}

export function rug(r: number): BoxSpec[] {
  const out: BoxSpec[] = [];
  const P: Painter = (t) => {
    const d = Math.hypot(t.x, t.z);
    const band = Math.floor((r - d) / 2.4);
    const cols = ['#7a2e3a', '#e2b860', '#a8403a', '#f3e2b8', '#3f6a8a', '#a8403a'];
    const c = cols[Math.max(0, band) % cols.length];
    return tone(R(c), lvl(t, { noise: 0.5, scale: 1.4 }) * 0.5 + ((Math.floor(t.x) + Math.floor(t.z)) % 2 ? 0.2 : -0.2));
  };
  for (let z = -r; z < r; z += 2) {
    const half = Math.sqrt(Math.max(0, r * r - (z + 1) ** 2));
    if (half > 1) out.push(box(0, 0, z + 1, half * 2, 0.6, 2, P));
  }
  return out;
}

export function hangingIvy(n: number, seed = 1): BoxSpec[] {
  const out: BoxSpec[] = [];
  for (let i = 0; i < n; i++) {
    const len = 10 + Math.floor(hash(i, seed, 1) * 22), x = i * 4 + (hash(i, seed, 2) - 0.5) * 2;
    for (let y = 0; y < len; y += 3) out.push(box(x + Math.sin(y * 0.4 + i) * 1.2, -y - 3, (hash(i, y, seed) - 0.5) * 3, 2.6, 2.6, 1.6, leaves(hash(i, y, 7) > 0.5 ? '#4c9b3b' : '#6cb845', { seed: i + y }), { sway: 0.6 }));
  }
  return out;
}

export function lanternHanging(): BoxSpec[] {
  return [
    box(0, 0, 0, 0.6, 10, 0.6, flat('#3a2a1a')), box(0, -2, 0, 6, 1.4, 6, brass), box(0, -8, 0, 5, 6, 5, lamp('#ffd36a'), { glow: true }),
    box(-2.6, -8, -2.6, 0.8, 6, 0.8, brass), box(2.6, -8, -2.6, 0.8, 6, 0.8, brass), box(-2.6, -8, 2.6, 0.8, 6, 0.8, brass), box(2.6, -8, 2.6, 0.8, 6, 0.8, brass),
    box(0, -9.4, 0, 6, 1.4, 6, brass),
  ];
}

// ------------------------------------------------------------------ Pip's accessories

/** Round reading glasses, centred between the eyes (local px, eyes at +-ex). */
export function glasses(ex: number, r: number): BoxSpec[] {
  const out: BoxSpec[] = [], gold = metal('#d8b048');
  for (const sd of [-1, 1]) {
    const cx = sd * ex;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, a2 = ((k + 1) / 12) * Math.PI * 2;
      const x0 = cx + Math.cos(a) * r, y0 = Math.sin(a) * r, x1 = cx + Math.cos(a2) * r, y1 = Math.sin(a2) * r;
      const len = Math.hypot(x1 - x0, y1 - y0) + 0.25, ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
      out.push({ ...box((x0 + x1) / 2, (y0 + y1) / 2 - 0.25, 0, len, 0.5, 0.5, gold), rot: [0, 0, ang], pivot: [(x0 + x1) / 2, (y0 + y1) / 2, 0] });
    }
    out.push(box(cx, -r + 0.3, -0.15, r * 1.7, r * 1.7, 0.1, flat('#cfe8ff'), { glass: true }));
    out.push(box(sd * (ex + r + 1.4), 0, -2, 0.4, 0.4, 4, gold));
  }
  out.push(box(0, 0.6, 0, ex * 2 - r * 2 + 0.4, 0.5, 0.5, gold));
  return out;
}

export function clipboardSmall(): BoxSpec[] {
  return [box(0, 0, 0, 9, 12, 0.8, wy('#8a5a34')), box(0, 0.8, 0.5, 8, 10, 0.3, paper()), box(0, 10.2, 0.7, 4, 1.6, 0.8, steel),
    box(0, 3, 0.75, 6, 0.3, 0.1, flat('#9dbde3')), box(0, 5, 0.75, 6, 0.3, 0.1, flat('#9dbde3')), box(-1, 7, 0.75, 4, 0.3, 0.1, flat('#9dbde3'))];
}

export function stampTool(): BoxSpec[] {
  return [box(0, 0, 0, 7, 1.4, 5, flat('#b0303a')), box(0, 1.4, 0, 6, 1.4, 4, wx('#8a5a34')), box(0, 2.8, 0, 2, 4, 2, wy('#a86d38')), box(0, 6.8, 0, 3.6, 3, 3.6, smooth('#b0303a'))];
}

// ------------------------------------------------------------------ vignette props

export function bed(): BoxSpec[] {
  const frame = wx('#a86d38', 0, 2), post = wy('#7b4b2c');
  const quilt = cloth('#4a6ab8', { check: '#6a8ad0', trim: '#f3e9cf', hem: 1 });
  const out: BoxSpec[] = [
    box(0, 2, 0, 24, 3, 34, frame), box(0, 5, 0, 22, 3, 32, cloth('#f6efdc')),
    box(0, 0, -16.5, 26, 16, 2, frame), box(0, 14, -16.5, 20, 3, 2, frame), box(0, 0, 16.5, 26, 9, 2, frame),
    box(0, 7.6, 4, 23, 1.8, 24, quilt), box(-11.6, 4, 4, 1, 4.5, 24, quilt), box(11.6, 4, 4, 1, 4.5, 24, quilt),
  ];
  for (const [x, z] of [[-12, -16.5], [12, -16.5], [-12, 16.5], [12, 16.5]]) out.push(box(x, 0, z, 3, z < 0 ? 18 : 11, 3, post), box(x, z < 0 ? 18 : 11, z, 3.6, 2, 3.6, brass));
  return out;
}
export function pillow(c = '#fbf6ea'): BoxSpec[] {
  const p = cloth(c, { shade: { noise: 0.2 } });
  return [box(0, 0, 0, 16, 3, 8, p), box(0, 0.6, 0, 18, 1.8, 6.4, p), box(0, 3, 0, 13, 1, 5.6, p)];
}
export function sheep(): BoxSpec[] {
  const wool: Painter = (t) => tone(R('#f4f1ea'), lvl(t, { noise: 1.2, scale: 1.1, rim: 0.5 }) * 0.6);
  const face = smooth('#3a3036');
  return [
    box(0, 4, 0, 10, 7, 13, wool), box(0, 10.5, -1, 8, 1.5, 10, wool), box(0, 6, 7, 5, 6, 4, face),
    box(-1.3, 9, 9.05, 1, 1, 0.2, flat('#ffffff')), box(1.3, 9, 9.05, 1, 1, 0.2, flat('#ffffff')),
    box(-3, 9.5, 7, 2, 1, 2, face), box(3, 9.5, 7, 2, 1, 2, face), box(0, 11, 6.5, 4, 2, 3, wool),
    ...[[-3, -4], [3, -4], [-3, 4], [3, 4]].map(([x, z]) => box(x, 0, z, 2, 4.5, 2, face)),
  ];
}
export function fence(): BoxSpec[] {
  const f = wy('#c9a16a'), rail = wx('#b88a52', 0);
  return [box(-9, 0, 0, 2, 12, 2, f), box(9, 0, 0, 2, 12, 2, f), box(0, 4, 0, 22, 2, 1.4, rail), box(0, 9, 0, 22, 2, 1.4, rail), box(-9, 12, 0, 1.2, 1, 1.2, f), box(9, 12, 0, 1.2, 1, 1.2, f)];
}
export function phone(): BoxSpec[] {
  const scr: Painter = (t) => (t.face === 2 ? (t.v === 0 || t.v === t.h - 1 || t.u === 0 || t.u === t.w - 1 ? 0x1a1a24 : (t.u + t.v) % 5 === 0 ? 0xbfe6ff : t.v > t.h - 4 ? 0xffd36a : 0x6aa8f0) : 0x2a2a36);
  return [box(0, 0, 0, 6, 0.9, 11, solid('#2a2a36', { noise: 0.1 })), box(0, 0.9, 0, 5.2, 0.15, 9.6, scr, { glow: true })];
}
export function mug(c = '#c94f3f'): BoxSpec[] {
  const m = smooth(c);
  return [box(0, 0, 0, 6, 6, 6, m), box(0, 5.6, 0, 4.6, 0.4, 4.6, flat('#4a2a14')), box(4, 1.5, 0, 2, 3.4, 1.2, m), box(0, 2.4, 3.05, 6, 1.2, 0.1, flat('#f3e9cf'))];
}
export function milk(): BoxSpec[] {
  return [box(0, 0, 0, 5, 7, 5, solid('#dff0ff', { noise: 0.1 }), { glass: true }), box(0, 0.3, 0, 4.4, 5.6, 4.4, smooth('#fbf8f0'))];
}
export function teapot(): BoxSpec[] {
  const p = smooth('#7ab8a0');
  return [box(0, 0, 0, 9, 6, 8, p), box(0, 6, 0, 6, 1.4, 5, p), box(0, 7.4, 0, 2, 1.2, 2, smooth('#e8c25a')), lean(box(5.5, 2, 0, 2, 5, 2, p), 0, 0, -40), box(-5.5, 2, 0, 1.5, 4, 1.4, p)];
}
export function microphone(): BoxSpec[] {
  const grill: Painter = (t) => tone(R('#aeb6c8'), lvl(t, { noise: 0 }) + ((t.u + t.v) % 2 ? 0.6 : -0.6));
  return [box(0, 0, 0, 7, 1.4, 6, steel), box(0, 1.4, 0, 1.4, 8, 1.4, steel), box(0, 9.4, 0, 4.6, 6, 4.6, grill), box(0, 9.2, 0, 5.2, 1, 5.2, brass), box(0, 15.2, 0, 3.6, 1, 3.6, grill)];
}
export function radio(): BoxSpec[] {
  const body = wx('#a8703f', 0, 4), sp: Painter = (t) => (t.face === 4 && (t.u + t.v) % 2 === 0 ? 0x5a3a24 : 0xe2c992);
  return [box(0, 0, 0, 14, 10, 7, body), box(-2.5, 2, 3.4, 7, 6, 0.4, sp), box(4.5, 6, 3.6, 2.2, 2.2, 0.8, brass), box(4.5, 2.6, 3.6, 2.2, 2.2, 0.8, brass), lean(box(5, 10, 0, 0.6, 9, 0.6, steel), 0, 0, -18)];
}
export function musicBox(): BoxSpec[] {
  const b = wx('#c9683f', 0, 6), lid = wx('#a8403a', 0, 2);
  return [box(0, 0, 0, 12, 6, 9, b), box(0, 6, -4.5, 12, 1.2, 9, lid), box(0, 6.2, 0, 10, 0.4, 7, flat('#f3e2b8')), box(0, 6.6, 0, 3, 3, 3, smooth('#f0a8b4')), box(-7, 3, 0, 2, 1, 1, brass)];
}
export function stove(): BoxSpec[] {
  const iron = solid('#3a3a44', { noise: 0.3 });
  return [box(0, 0, 0, 14, 12, 12, iron), box(0, 12, 0, 16, 2, 14, iron), box(0, 2, 6.1, 9, 7, 0.4, lamp('#ff9a3a'), { glow: true }), box(0, 14, -3, 4, 20, 4, iron), ...[[-6, -5], [6, -5], [-6, 5], [6, 5]].map(([x, z]) => box(x, -2, z, 2, 2, 2, iron))];
}
export function bookOpen(): BoxSpec[] {
  const cover = smooth('#7a2e3a'), pg = paper();
  return [box(0, 0, 0, 16, 0.8, 11, cover), { ...box(-3.8, 0.8, 0, 7.4, 1.4, 10, pg), rot: [0, 0, 6], pivot: [0, 0.8, 0] }, { ...box(3.8, 0.8, 0, 7.4, 1.4, 10, pg), rot: [0, 0, -6], pivot: [0, 0.8, 0] }];
}
export function alarmClock(): BoxSpec[] {
  const red = smooth('#d9453b');
  return [box(0, 1, 0, 9, 9, 4, red), box(0, 2.4, 2.05, 6.4, 6.4, 0.2, flat('#f6ecd2')), box(-3, 10, 0, 3, 2, 3, brass), box(3, 10, 0, 3, 2, 3, brass), box(-3, 0, 0, 1.4, 1.4, 1.4, brass), box(3, 0, 0, 1.4, 1.4, 1.4, brass),
    box(0, 5.5, 2.2, 0.6, 2.6, 0.2, flat('#2a1a14')), box(1, 5.5, 2.2, 2.2, 0.6, 0.2, flat('#2a1a14'))];
}
export function coffeeBeans(): BoxSpec[] {
  return [0, 1, 2, 3, 4].map((i) => box(Math.cos(i * 1.3) * 3, 0, Math.sin(i * 1.3) * 3, 2, 1.2, 1.4, smooth('#5a3420')));
}
export function sunflowerPot(): BoxSpec[] {
  return [box(0, 0, 0, 6, 5, 6, solid('#c9683f')), box(0, 5, 0, 1, 10, 1, leaves('#4c9b3b')), box(0, 14, 0.5, 7, 7, 1, smooth('#ffcc34')), box(0, 16, 1.1, 3, 3, 0.6, smooth('#6a3a1a'))];
}
export function noteCard(): BoxSpec[] {
  return [box(0, 0, 0, 8, 0.4, 10, paper('#f9d856')), box(0, 0.4, 0, 6, 0.1, 0.6, flat('#3a4a8a'))];
}
