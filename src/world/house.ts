// Pip's tree house: a hollow old oak cut open like a dollhouse so you can see inside. Bark outside,
// warm carved wood inside, growth rings on every cut edge, a plank floor, a ladder up to a loft,
// round windows that glow at night, a chimney, roots, a porch and a huge canopy. Parts of it start
// locked (the loft, the stargazing deck) and open up as the owl levels up.
import * as THREE from 'three';
import { box, buildProp, lean, propMesh, PX, type BoxSpec, type Painter, type Texel } from '../gfx/box.ts';
import { ramp, tone } from '../gfx/color.ts';
import { bark, dirt, lamp, leaves, lvl, metal, R, rock, solid, wood } from '../gfx/mats.ts';
import { fbm, hash } from '../gfx/noise.ts';
import { HOUSE } from './layout.ts';

export type Zone = 'loft' | 'deck' | 'garden';

export interface Slot {
  id: string;
  zone: 'ground' | Zone;
  /** world position in blocks (floor height included) */
  pos: THREE.Vector3;
  /** facing in radians (0 = +z) */
  rot: number;
  kind: 'floor' | 'wall' | 'rug';
  label: string;
}

const RO = 44, T = 9, H = 96, LOFT = 52, NSEG = 26;
const SILL = 13;

const ringWood = (): Painter => {
  const r = ramp(0xd9a865), dark = ramp(0x7a4a28);
  return (t) => {
    const d = Math.hypot(t.x, t.z);
    if (RO - d < 2.2) return tone(dark, -0.3 + (hash(Math.floor(t.x), 0, Math.floor(t.z), 4) - 0.5));
    return tone(r, (Math.floor(d / 1.6) % 2 ? -0.7 : 0.35) + (hash(Math.floor(t.x * 2), 1, Math.floor(t.z * 2), 3) - 0.5) * 0.5);
  };
};

/** One wall segment: bark on the outside (local +z), carved wood inside, rings on cut tops. */
function wallPainter(): Painter {
  const b = bark('#7a5434', { seed: 5, moss: '#5f9a3e', mossTo: 26 }), rings = ringWood();
  const inner = R('#c58a52'), wain = R('#8a5a34');
  return (t) => {
    if (t.face === 4) return b(t);
    if (t.face === 2) return rings(t);
    if (t.face === 3) return tone(wain, -1);
    if (t.face === 5) {
      // inside: smooth carved heartwood with soft vertical grain, a darker wainscot band and a lit rail
      const ang = Math.atan2(t.x, t.z), along = ang * RO;
      let L = (fbm(along / 6, t.y / 22, 3, 7) - 0.5) * 1.8 + (Math.floor(along / 2.2) % 5 === 0 ? -0.5 : 0);
      if (t.y < 16) return tone(wain, L * 0.7 + (Math.floor(along / 4) % 2 ? -0.3 : 0.2) + (t.y > 14.6 ? 1.2 : 0));
      if (t.y > 16 && t.y < 17.4) return tone(inner, 1.6);
      L += (t.y - 50) * 0.008;
      return tone(inner, L);
    }
    return tone(R('#5a3c24'), lvl(t, { noise: 0.4 }) * 0.6 - 0.4);
  };
}

/** A lumpy sphere of leaves built from stacked, shrinking slabs. */
function leafBlob(cx: number, cy: number, cz: number, r: number, m: Painter, sway = 0.25): BoxSpec[] {
  const out: BoxSpec[] = [];
  // a flattened, lumpy ball: three slabs (bottom, wide middle, top) each a cross of two boxes
  const prof: [number, number, number][] = [[-0.62, -0.2, 0.72], [-0.2, 0.34, 1], [0.34, 0.72, 0.66]];
  for (const [a, b, wf] of prof) {
    const w = 2 * r * wf;
    out.push(box(cx, cy + a * r, cz, w, (b - a) * r, w * 0.78, m, { sway }), box(cx, cy + a * r, cz, w * 0.78, (b - a) * r, w, m, { sway }));
  }
  return out;
}

function buildTrunk(): BoxSpec[] {
  const out: BoxSpec[] = [];
  const wall = wallPainter();
  const segW = (2 * Math.PI * RO) / NSEG * 1.1;
  for (let i = 0; i < NSEG; i++) {
    const a = (i / NSEG) * Math.PI * 2, deg = (a * 180) / Math.PI;
    const front = Math.cos(a) > 0.48; // the cut-away arc facing the camera
    const edge = !front && Math.cos(a) > 0.2;
    const rr = RO - T / 2;
    const cx = Math.sin(a) * rr, cz = Math.cos(a) * rr;
    let h = front ? SILL + Math.round(hash(i, 2, 0, 5) * 3) : H + 18 + Math.round(hash(i, 1, 0, 5) * 6);
    if (edge) h = H + 10;
    out.push({ ...box(cx, 0, cz, segW, h, T, wall, { tag: 'wall' }), rot: [0, deg, 0], pivot: [cx, 0, cz] });
    // the cut edges at the sides of the opening show a broken, splintered profile
    if (edge) out.push({ ...box(cx, h, cz, segW * 0.6, 8 + hash(i, 3, 0, 5) * 10, T, wall, { tag: 'wall' }), rot: [0, deg, 0], pivot: [cx, h, cz] });
  }
  // upper trunk: narrower ring closing over the room, then branches and the canopy
  const b = bark('#7a5434', { seed: 8, moss: '#5f9a3e', mossTo: 140 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, rr = 34, cx = Math.sin(a) * rr, cz = Math.cos(a) * rr;
    out.push({ ...box(cx, H + 16, cz, 15, 26, 12, b), rot: [0, (a * 180) / Math.PI, 0], pivot: [cx, H + 16, cz] });
  }
  out.push(box(0, H + 16, 0, 56, 30, 56, b), box(0, H + 46, 0, 40, 18, 40, b));
  // ceiling inside the room
  const ceil = wood('#9a6a40', { axis: 'x', plank: 4 });
  for (let z = -36; z < 36; z += 4) { const w = 2 * Math.sqrt(Math.max(0, 37 * 37 - (z + 2) ** 2)); if (w > 4) out.push(box(0, H, z + 2, w, 3, 4, ceil, { skip: 'u' })); }
  // big branches
  for (const [ax, az, len, up, th] of [[-1, -0.4, 66, 34, 14], [1, -0.5, 70, 30, 14], [0.8, 0.7, 48, 40, 11], [-0.7, 0.8, 46, 44, 11], [0.1, -1, 52, 36, 12]] as const) {
    const yaw = Math.atan2(ax, az) * 57.3;
    out.push({ ...box(0, H + 40, 0, th, len, th, b), rot: [up, yaw, 0], pivot: [0, H + 40, 0] });
  }
  // canopy: a loose crown of overlapping leaf clumps, lumpy and uneven like a real old oak
  const lf = leaves('#4f9a3c', { seed: 3, bloom: '#e8f2a0', rate: 0.02 }), lf2 = leaves('#5fae44', { seed: 6 }), lf3 = leaves('#3f8a36', { seed: 9 });
  const mats = [lf, lf2, lf3];
  let k = 0;
  for (const [x, y, z, r] of [
    [0, H + 80, -10, 32], [-38, H + 76, -4, 30], [40, H + 74, -8, 30], [-74, H + 62, -12, 24], [78, H + 60, -16, 24],
    [-20, H + 94, -22, 26], [24, H + 92, -20, 26], [-56, H + 84, -30, 22], [58, H + 82, -32, 22],
    [-28, H + 66, 28, 22], [32, H + 68, 26, 22], [0, H + 84, 22, 22], [-64, H + 70, 16, 18], [66, H + 68, 12, 18],
    [-8, H + 64, -50, 26], [30, H + 62, -52, 24], [-96, H + 50, -4, 14], [100, H + 48, -8, 14], [-40, H + 54, 34, 14], [44, H + 52, 34, 13],
  ] as const) {
    const jx = (hash(k, 1, 2, 3) - 0.5) * 8, jy = (hash(k, 2, 2, 3) - 0.5) * 6, jz = (hash(k, 3, 2, 3) - 0.5) * 8;
    out.push(...leafBlob(x + jx, y + jy, z + jz, r * (0.9 + hash(k, 4, 2, 3) * 0.25), mats[k % 3]));
    k++;
  }
  // roots spreading into the ground (kept clear of the porch)
  const rootB = bark('#6e4c30', { seed: 11, moss: '#5f9a3e', mossTo: 10 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.35;
    if (Math.cos(a) > 0.82) continue;
    const yaw = (a * 180) / Math.PI;
    const x = Math.sin(a) * (RO + 3), z = Math.cos(a) * (RO + 3);
    out.push({ ...box(x, -3, z, 9, 10, 16, rootB), rot: [24, yaw, 0], pivot: [x, 0, z] });
    out.push({ ...box(Math.sin(a) * (RO + 14), -4, Math.cos(a) * (RO + 14), 6, 6, 14, rootB), rot: [16, yaw, 0], pivot: [Math.sin(a) * (RO + 14), 0, Math.cos(a) * (RO + 14)] });
  }
  // shelf fungus and moss pads on the bark
  const fungus = solid('#e0a65a', { noise: 0.5 });
  for (const [a, y] of [[-1.9, 34], [-2.0, 40], [2.3, 70], [2.25, 76], [-2.6, 86]] as const) {
    out.push({ ...box(Math.sin(a) * (RO + 2), y, Math.cos(a) * (RO + 2), 8, 2, 5, fungus), rot: [0, (a * 180) / Math.PI, 0] });
  }
  return out;
}

function buildInterior(): BoxSpec[] {
  const out: BoxSpec[] = [];
  const fl = wood('#c08550', { axis: 'x', plank: 4, seed: 2 });
  const rIn = RO - T + 0.5;
  for (let z = -rIn; z < rIn; z += 4) {
    const zc = z + 2, w = 2 * Math.sqrt(Math.max(0, rIn * rIn - zc * zc)) + 2;
    if (w > 3) out.push(box(0, 0, zc, w, 3, 4, fl, { skip: 'd' }));
  }
  // porch: a step and a little deck in front of the opening
  const deck = wood('#a8703f', { axis: 'x', plank: 4, seed: 4 });
  out.push(box(0, -2, RO + 4, 46, 3, 12, deck), box(0, -3, RO + 12, 34, 2, 6, deck));
  for (const x of [-21, 21]) out.push(box(x, -6, RO + 8, 3, 5, 3, wood('#7b4b2c', { axis: 'y' })));
  // welcome mat
  const mat: Painter = (t) => tone(R('#c94f3f'), lvl(t, { noise: 0.3 }) * 0.6 + ((Math.floor(t.x) + Math.floor(t.z)) % 4 === 0 ? 0.8 : 0) + (Math.abs(t.x) > 7 || Math.abs(t.z - (RO + 4)) > 3.5 ? -1 : 0));
  out.push(box(0, 1, RO + 4, 16, 0.4, 8, mat));
  // ladder up to the loft
  const lad = wood('#8a5a34', { axis: 'y' });
  for (const x of [-30, -22]) out.push({ ...box(x, 3, -6, 1.8, LOFT + 2, 1.8, lad), rot: [-8, 0, 0], pivot: [x, 3, -6] });
  for (let y = 9; y < LOFT; y += 7) out.push({ ...box(-26, y, -6 - (y - 3) * Math.tan(8 / 57.3), 8, 1.2, 1.4, wood('#a8703f', { axis: 'x', plank: 0 })) });
  // hanging lantern
  out.push(box(0, H - 14, -6, 0.6, 14, 0.6, metal('#4a4a52')), box(0, H - 22, -6, 6, 1, 6, metal('#4a4a52')), box(0, H - 30, -6, 6, 1, 6, metal('#4a4a52')));
  out.push(box(0, H - 29, -6, 4.6, 7, 4.6, lamp('#ffd27a'), { glow: true, tag: 'lamp' }));
  // round windows (frames only; panes are separate meshes so they can glow at night)
  for (const a of [-1.75, 1.75, 2.75]) {
    const yaw = (a * 180) / Math.PI, y = a === 2.75 ? LOFT + 18 : 44;
    for (const sgn of [1, -1]) {
      const rr = sgn > 0 ? RO + 0.6 : RO - T - 0.6, cx = Math.sin(a) * rr, cz = Math.cos(a) * rr;
      const fr = wood('#6a4428', { axis: 'y' });
      out.push({ ...box(cx, y - 8, cz, 16, 2, 1.6, fr), rot: [0, yaw, 0], pivot: [cx, y, cz] }, { ...box(cx, y + 6, cz, 16, 2, 1.6, fr), rot: [0, yaw, 0], pivot: [cx, y, cz] });
      out.push({ ...box(cx, y - 6, cz, 16, 12, 1.6, (t: Texel) => (Math.abs(t.by - 6) < 0.8 || Math.hypot(t.bx - 8, t.by - 6) > 7.2 ? fr(t) : -1), { cut: true }), rot: [0, yaw, 0], pivot: [cx, y, cz] });
    }
  }
  // chimney up the right side
  const st = rock('#8f8a84', { seed: 6, moss: '#6aa04a' });
  const ca = 1.15, cx = Math.sin(ca) * (RO + 4), cz = Math.cos(ca) * (RO + 4);
  out.push({ ...box(cx, 0, cz, 12, H + 34, 10, st), rot: [0, ca * 57.3, 0], pivot: [cx, 0, cz] });
  out.push({ ...box(cx, H + 34, cz, 14, 4, 12, st), rot: [0, ca * 57.3, 0], pivot: [cx, H + 34, cz] });
  // name board over the opening
  const sign: Painter = (t) => {
    if (t.face !== 4) return wood('#8a5a34', { axis: 'x' })(t);
    const u = t.bx, v = t.by;
    // a little moon and three stars branded into the board
    if (Math.hypot(u - 6, v - 3.5) < 2.2 && Math.hypot(u - 6.9, v - 4.1) > 1.8) return 0xfff0b0;
    if ([[14, 4.4], [19, 2.6], [24, 4.2], [29, 3]].some(([x, y]) => Math.abs(u - x) + Math.abs(v - y) < 0.9)) return 0xffe08a;
    return tone(R('#b07a44'), lvl(t, { noise: 0.3 }) * 0.6 + (Math.floor(v) === 0 || Math.floor(v) === 6 ? -0.8 : 0));
  };
  out.push({ ...box(0, H - 4, RO + 1.5, 34, 7, 2, sign), rot: [-6, 0, 0] });
  return out;
}

function buildLoft(): BoxSpec[] {
  const out: BoxSpec[] = [], fl = wood('#b67c48', { axis: 'x', plank: 4, seed: 7 }), post = wood('#7b4b2c', { axis: 'y' });
  const rIn = RO - T + 0.5;
  for (let z = -rIn; z < 4; z += 4) {
    const zc = z + 2, w = 2 * Math.sqrt(Math.max(0, rIn * rIn - zc * zc)) + 2;
    if (w > 3) out.push(box(0, LOFT, zc, w, 3, 4, fl));
  }
  for (let x = -26; x <= 26; x += 6.5) if (Math.abs(x + 26) > 4) out.push(box(x, LOFT + 3, 4.5, 1.6, 9, 1.6, post));
  out.push(box(4, LOFT + 11.5, 4.5, 50, 1.8, 2, wood('#a8703f', { axis: 'x', plank: 0 })));
  out.push(box(0, LOFT - 3, 4.2, 62, 3, 2, wood('#7b4b2c', { axis: 'x', plank: 0 })));
  return out;
}

function buildBoards(): BoxSpec[] {
  const board = wood('#8a6a4a', { axis: 'x', plank: 0, seed: 3 }), nail = metal('#8a8f9a');
  const out: BoxSpec[] = [];
  for (const [y, r] of [[LOFT + 4, 4], [LOFT + 14, -6], [LOFT + 24, 3]] as const) {
    out.push({ ...box(0, y, 6, 66, 6, 2, board), rot: [0, 0, r] });
    out.push({ ...box(-26, y + 2, 7.2, 1, 1, 0.6, nail), rot: [0, 0, r], pivot: [0, y + 3, 6] }, { ...box(26, y + 2, 7.2, 1, 1, 0.6, nail), rot: [0, 0, r], pivot: [0, y + 3, 6] });
  }
  // a cobweb in the corner of the boarded loft
  const web: Painter = (t) => { const u = t.bx, v = t.sy - t.by; const d = Math.hypot(u, v), a = Math.atan2(v, u); return (Math.abs(d % 3) < 0.35 || Math.abs((a * 8) % 1) < 0.08) && d < t.sx ? 0xf4f2ee : -1; };
  out.push({ ...box(-24, LOFT + 26, 6.4, 12, 12, 0.3, web, { cut: true }) });
  return out;
}

function buildDeck(): BoxSpec[] {
  // a little stargazing deck on the right branch
  const out: BoxSpec[] = [], fl = wood('#a8703f', { axis: 'z', plank: 4 }), post = wood('#7b4b2c', { axis: 'y' });
  const x0 = 62, y0 = H + 48;
  out.push(box(x0, y0, 0, 30, 3, 30, fl));
  for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13], [0, 13], [13, 0], [0, -13]] as const) out.push(box(x0 + x, y0 + 3, z, 1.6, 9, 1.6, post));
  out.push(box(x0, y0 + 11, 13, 28, 1.6, 1.6, post), box(x0 + 13, y0 + 11, 0, 1.6, 1.6, 28, post), box(x0, y0 + 11, -13, 28, 1.6, 1.6, post));
  // brace down to the trunk
  out.push({ ...box(x0 - 10, y0 - 30, 0, 3, 32, 3, post), rot: [0, 0, 40], pivot: [x0 - 10, y0, 0] });
  return out;
}

export interface House {
  group: THREE.Group;
  slots: Slot[];
  /** window panes: day = dark glass, night = warm light */
  panes: THREE.MeshBasicMaterial;
  lampAt: THREE.Vector3;
  chimneyTop: THREE.Vector3;
  /** where the owl stands on the porch / sleeps / sits in the loft */
  spots: { porch: THREE.Vector3; bed: THREE.Vector3; inside: THREE.Vector3; loft: THREE.Vector3 };
  setZone(z: Zone, open: boolean): void;
  zones: Record<Zone, boolean>;
}

export function buildHouse(): House {
  const group = new THREE.Group();
  group.position.set(HOUSE.x, 0, HOUSE.z);
  const trunk = propMesh(buildProp(buildTrunk(), { wind: true, swayH: 260 }));
  const inner = propMesh(buildProp(buildInterior()));
  const loft = propMesh(buildProp(buildLoft()));
  const boards = propMesh(buildProp(buildBoards()));
  const deck = propMesh(buildProp(buildDeck()));
  group.add(trunk, inner, loft, boards, deck);

  // window panes
  const panes = new THREE.MeshBasicMaterial({ color: 0x2a3550, side: THREE.DoubleSide, toneMapped: false });
  const paneGeo = new THREE.CircleGeometry(7 * PX, 12);
  for (const a of [-1.75, 1.75, 2.75]) {
    const y = a === 2.75 ? LOFT + 18 : 44, rr = RO - T / 2;
    const m = new THREE.Mesh(paneGeo, panes);
    m.position.set(Math.sin(a) * rr * PX, y * PX, Math.cos(a) * rr * PX);
    m.rotation.y = a;
    group.add(m);
  }

  const world = (x: number, y: number, z: number) => new THREE.Vector3(HOUSE.x + x * PX, y * PX, HOUSE.z + z * PX);
  const fy = 3 * PX, ly = (LOFT + 3) * PX;
  const slots: Slot[] = [
    { id: 'g_back', zone: 'ground', pos: world(0, 3, -22), rot: 0, kind: 'floor', label: 'Back of the room' },
    { id: 'g_left', zone: 'ground', pos: world(-21, 3, -12), rot: 0.75, kind: 'floor', label: 'Left corner' },
    { id: 'g_right', zone: 'ground', pos: world(21, 3, -12), rot: -0.75, kind: 'floor', label: 'Right corner' },
    { id: 'g_mid', zone: 'ground', pos: world(0, 3.1, 4), rot: 0, kind: 'rug', label: 'Middle of the floor' },
    { id: 'g_frontL', zone: 'ground', pos: world(-24, 3, 10), rot: 1.2, kind: 'floor', label: 'Front left' },
    { id: 'g_frontR', zone: 'ground', pos: world(24, 3, 10), rot: -1.2, kind: 'floor', label: 'Front right' },
    { id: 'w_back', zone: 'ground', pos: world(0, 62, -33.5), rot: 0, kind: 'wall', label: 'Back wall' },
    { id: 'l_left', zone: 'loft', pos: world(-14, LOFT + 3, -18), rot: 0.4, kind: 'floor', label: 'Loft, left' },
    { id: 'l_right', zone: 'loft', pos: world(16, LOFT + 3, -16), rot: -0.4, kind: 'floor', label: 'Loft, right' },
    { id: 'l_wall', zone: 'loft', pos: world(0, LOFT + 26, -33.5), rot: 0, kind: 'wall', label: 'Loft wall' },
    { id: 'd_1', zone: 'deck', pos: world(56, H + 51, -4), rot: -0.5, kind: 'floor', label: 'Deck' },
    { id: 'd_2', zone: 'deck', pos: world(68, H + 51, 6), rot: -1.2, kind: 'floor', label: 'Deck corner' },
  ];
  void fy; void ly;
  const zones: Record<Zone, boolean> = { loft: false, deck: false, garden: false };
  const house: House = {
    group, slots, panes, zones,
    lampAt: world(0, H - 26, -6),
    chimneyTop: world(Math.sin(1.15) * (RO + 4), H + 40, Math.cos(1.15) * (RO + 4)),
    spots: { porch: world(0, 1.4, RO + 6), bed: world(0, 9, -22), inside: world(0, 3, -2), loft: world(-2, LOFT + 3, -10) },
    setZone(z, open) {
      zones[z] = open;
      if (z === 'loft') { loft.visible = open; boards.visible = !open; }
      if (z === 'deck') deck.visible = open;
    },
  };
  house.setZone('loft', false);
  house.setZone('deck', false);
  return house;
}

/** Garden plot fence + soil beds, shown when the garden is unlocked; tangled weeds when it is not. */
export function buildGardenFence(cx: number, cz: number, hw: number, hd: number): THREE.Mesh {
  const post = wood('#e9e2d2', { axis: 'y' }), rail = wood('#e2d9c4', { axis: 'x', plank: 0 });
  const out: BoxSpec[] = [];
  const W = hw * 16, D = hd * 16;
  for (let x = -W; x <= W; x += 8) for (const z of [-D, D]) if (!(z > 0 && Math.abs(x) < 9)) out.push(box(x, 0, z, 2, 9, 2, post), box(x, 9, z, 1, 1, 1, post));
  for (let z = -D + 8; z < D; z += 8) for (const x of [-W, W]) out.push(box(x, 0, z, 2, 9, 2, post));
  for (const y of [3, 7]) {
    out.push(box(0, y, -D, W * 2, 1.2, 1, rail), box(-(W + 9) / 2 - 0.5, y, D, W - 9, 1.2, 1, rail), box((W + 9) / 2 + 0.5, y, D, W - 9, 1.2, 1, rail));
    out.push(box(-W, y, 0, 1, 1.2, D * 2, wood('#e2d9c4', { axis: 'z', plank: 0 })), box(W, y, 0, 1, 1.2, D * 2, wood('#e2d9c4', { axis: 'z', plank: 0 })));
  }
  out.push(box(-W + 10, -0.6, -D + 8, 18, 1.4, 8, dirt('#5c3d2a')), box(W - 10, -0.6, -D + 8, 18, 1.4, 8, dirt('#5c3d2a')));
  const m = propMesh(buildProp(out));
  m.position.set(cx, 0, cz);
  return m;
}
