// Hollow & Co.'s executive office, built in code: a panelled room inside the oak (mahogany wainscot, emerald
// regency-stripe walls, a coffered ceiling, oak chevron parquet under a Persian rug), built-in bookcases full of
// binders and ledgers, a big mahogany pedestal desk with a tooled green leather inlay, a tufted oxblood wingback,
// a credenza, filing cabinets, framed paintings and certificates, a tall window with venetian blinds and the real
// forest outside. Every piece is real geometry with hand-painted pixel textures (tex.ts / mats.ts).
import * as THREE from 'three';
import { at, Batch, bbox, cardBox, cyl, lathe, mat } from './kit.ts';
import type { OfficeMats } from './mats.ts';
import { C, cloth, crispText, hash, hexCSS, lerpRamp, mix3, mul3, paper as paperFill, rgb, Tex, type RGB } from './tex.ts';
import { F } from './fonts.ts';

/** Where everything is (metres; +z towards the visitor, y up). */
export const L = {
  W: 7, H: 3.2, x0: -3.5, x1: 3.5, z0: -3.2, z1: 3.8,
  wains: 0.98,
  desk: { x: 0, z: -1.0, w: 2.0, d: 0.95, h: 0.78 },
  chair: { x: 0, z: -1.98 },
  seat: 0.5,
  window: { z: -0.95, w: 1.5, y0: 0.92, y1: 2.62, depth: 0.38 },
  clock: { x: 0, y: 2.05, z: -3.2 },
  cred: { x: 0, z: -2.94, w: 1.9, d: 0.5, h: 0.8 },
  shelves: [{ x0: -3.32, x1: -1.18 }, { x0: 1.18, x1: 3.32 }],
  shelfD: 0.4, shelfH: 2.78,
  cabinets: { x: 3.5 - 0.3, z: 0.55 },
};
export const DESK_TOP = L.desk.h;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ the shell

export function buildRoom(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'room';
  const { x0, x1, z0, z1, H } = L;
  const W = x1 - x0, D = z1 - z0;
  // floor and ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m.parquet);
  floor.rotation.x = -Math.PI / 2; floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const fuv = floor.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * W * 0.5, fuv.getY(i) * D * 0.5);
  floor.receiveShadow = true;
  g.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.6), m.rug);
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -0.55);
  rug.receiveShadow = true;
  g.add(rug);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m.plaster);
  ceil.castShadow = true;
  ceil.rotation.x = Math.PI / 2; ceil.position.set((x0 + x1) / 2, H, (z0 + z1) / 2);
  const cuv = ceil.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * W * 2, cuv.getY(i) * D * 2);
  g.add(ceil);

  const b = new Batch();
  // a coffered ceiling: a grid of shallow mahogany beams (none down the middle, where the camera looks up)
  for (const x of [-2.4, -1.2, 1.2, 2.4]) b.add(m.mahoganyDark, at(bbox(0.12, 0.12, D, { r: 0.01 }), x, H - 0.12, (z0 + z1) / 2));
  for (const z of [z0 + 1.2, z0 + 2.4, z0 + 3.6, z0 + 4.8, z0 + 6.0]) b.add(m.mahoganyDark, at(bbox(W, 0.1, 0.12, { r: 0.01 }), (x0 + x1) / 2, H - 0.1, z));

  // walls: each a list of [from, to] runs along the wall (gaps for the window)
  type Wall = { o: THREE.Vector3; dir: THREE.Vector3; n: THREE.Vector3; len: number; gaps: [number, number][] };
  const win = L.window;
  const walls: Wall[] = [
    { o: V(x0, 0, z0), dir: V(1, 0, 0), n: V(0, 0, 1), len: W, gaps: [] },                       // back
    { o: V(x0, 0, z1), dir: V(0, 0, -1), n: V(1, 0, 0), len: D, gaps: [[z1 - (win.z + win.w / 2 + 0.12), z1 - (win.z - win.w / 2 - 0.12)]] }, // left
    { o: V(x1, 0, z0), dir: V(0, 0, 1), n: V(-1, 0, 0), len: D, gaps: [] },                      // right
    { o: V(x1, 0, z1), dir: V(-1, 0, 0), n: V(0, 0, -1), len: W, gaps: [] },                     // front
  ];
  for (const w of walls) {
    const ry = Math.atan2(w.dir.x, w.dir.z) - Math.PI / 2;
    const put = (geo: THREE.BufferGeometry, s: number, y: number, inset: number) => {
      const p = w.o.clone().addScaledVector(w.dir, s).addScaledVector(w.n, inset);
      return at(geo, p.x, y, p.z, 0, ry, 0);
    };
    // runs between the gaps
    const runs: [number, number][] = [];
    let s0 = 0;
    for (const [a, bb] of w.gaps) { runs.push([s0, a]); s0 = bb; }
    runs.push([s0, w.len]);
    for (const [a, c] of runs) {
      const len = c - a, mid = (a + c) / 2;
      if (len < 0.02) continue;
      // wallpaper above the chair rail, up to the crown
      const paperH = H - L.wains;
      const wp = new THREE.PlaneGeometry(len, paperH);
      const uv = wp.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len + a) * 2, uv.getY(i) * paperH * 2);
      wp.translate(0, L.wains + paperH / 2, 0);
      b.add(m.wallpaper, put(wp, mid, 0, 0));
      // wainscot: a backing board, raised panels, the chair rail and a skirting board
      b.add(m.mahogany, put(bbox(len, L.wains, 0.03, { r: 0.002, along: 'y' }), mid, 0, 0.015));
      const n = Math.max(1, Math.round(len / 0.72)), pw = len / n;
      for (let i = 0; i < n; i++) {
        const cx = a + pw * (i + 0.5);
        if (pw > 0.25) b.add(m.mahogany, put(bbox(pw - 0.16, L.wains - 0.42, 0.03, { r: 0.012, along: 'y' }), cx, 0.24, 0.035));
      }
      b.add(m.mahoganyDark, put(bbox(len, 0.07, 0.05, { r: 0.012 }), mid, L.wains - 0.04, 0.03));
      b.add(m.mahoganyDark, put(bbox(len, 0.17, 0.04, { r: 0.006 }), mid, 0, 0.035));
      // crown moulding: three steps
      b.add(m.mahoganyDark, put(bbox(len, 0.06, 0.1, { r: 0.01 }), mid, H - 0.06, 0.05));
      b.add(m.mahogany, put(bbox(len, 0.08, 0.06, { r: 0.01 }), mid, H - 0.14, 0.03));
      b.add(m.mahoganyDark, put(bbox(len, 0.03, 0.03, { r: 0.006 }), mid, H - 0.17, 0.015));
    }
  }
  g.add(b.build('shell', { cast: true }));
  return g;
}

// ------------------------------------------------------------------ the window (left wall), its blinds and the view

export interface WindowParts { group: THREE.Group; view: THREE.Mesh; slats: THREE.InstancedMesh; glassAt: THREE.Vector3; normal: THREE.Vector3; tilt(a: number): void; opening: { y0: number; y1: number; z0: number; z1: number; x: number } }

export function buildWindow(m: OfficeMats, viewMat: THREE.Material): WindowParts {
  const w = L.window, g = new THREE.Group();
  g.name = 'window';
  const x = L.x0, dep = w.depth;
  const z0 = w.z - w.w / 2, z1 = w.z + w.w / 2, y0 = w.y0, y1 = w.y1, hh = y1 - y0;
  const b = new Batch();
  // the reveal: the oak's own heartwood (the wall is the tree)
  b.add(m.heartwood, at(bbox(dep, 0.04, w.w + 0.08, { r: 0.004 }), x - dep / 2, y0 - 0.04, w.z));
  b.add(m.heartwood, at(bbox(dep, 0.04, w.w + 0.08, { r: 0.004 }), x - dep / 2, y1, w.z));
  b.add(m.heartwood, at(bbox(dep, hh, 0.04, { r: 0.004 }), x - dep / 2, y0, z0 - 0.02));
  b.add(m.heartwood, at(bbox(dep, hh, 0.04, { r: 0.004 }), x - dep / 2, y0, z1 + 0.02));
  // the wall around the window opening (filling the wallpaper gap): wainscot below, wallpaper above, the casing
  const gz0 = z0 - 0.12, gz1 = z1 + 0.12;
  b.add(m.mahogany, at(bbox(0.03, L.wains, gz1 - gz0, { r: 0.002, along: 'z' }), x + 0.015, 0, (gz0 + gz1) / 2));
  b.add(m.mahogany, at(bbox(0.03, L.wains - 0.42, gz1 - gz0 - 0.2, { r: 0.012, along: 'z' }), x + 0.035, 0.24, (gz0 + gz1) / 2));
  b.add(m.mahoganyDark, at(bbox(0.05, 0.17, gz1 - gz0, { r: 0.006 }), x + 0.035, 0, (gz0 + gz1) / 2));
  const wp = (zA: number, zB: number, yA: number, yB: number) => {
    const p = new THREE.PlaneGeometry(zB - zA, yB - yA);
    const uv = p.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (zB - zA) + zA) * 2, (uv.getY(i) * (yB - yA) + yA) * 2);
    p.rotateY(Math.PI / 2);
    p.translate(x, (yA + yB) / 2, (zA + zB) / 2);
    return p;
  };
  b.add(m.wallpaper, wp(gz0, gz1, y1 + 0.04, L.H), wp(gz0, z0 - 0.02, L.wains, y1 + 0.04), wp(z1 + 0.02, gz1, L.wains, y1 + 0.04));
  b.add(m.wallpaper, wp(z0 - 0.02, z1 + 0.02, L.wains, y0 - 0.04));
  // casing: a moulded mahogany architrave with a sill
  b.add(m.mahoganyDark, at(bbox(0.05, 0.1, w.w + 0.36, { r: 0.012 }), x + 0.025, y1 + 0.02, w.z));
  b.add(m.mahogany, at(bbox(0.04, 0.05, w.w + 0.42, { r: 0.01 }), x + 0.03, y1 + 0.12, w.z));
  b.add(m.mahoganyDark, at(bbox(0.05, hh + 0.1, 0.1, { r: 0.012 }), x + 0.025, y0 - 0.06, z0 - 0.07));
  b.add(m.mahoganyDark, at(bbox(0.05, hh + 0.1, 0.1, { r: 0.012 }), x + 0.025, y0 - 0.06, z1 + 0.07));
  b.add(m.mahogany, at(bbox(0.16, 0.045, w.w + 0.34, { r: 0.012 }), x + 0.06, y0 - 0.09, w.z));
  b.add(m.mahoganyDark, at(bbox(0.05, 0.08, w.w + 0.2, { r: 0.008 }), x + 0.03, y0 - 0.17, w.z));
  // sash frame and glazing bars, set back in the reveal
  const fx = x - dep + 0.06;
  const fr = (gg: THREE.BufferGeometry) => b.add(m.walnut, gg);
  fr(at(bbox(0.05, 0.05, w.w, { r: 0.006 }), fx, y0, w.z)); fr(at(bbox(0.05, 0.05, w.w, { r: 0.006 }), fx, y1 - 0.05, w.z));
  fr(at(bbox(0.05, hh, 0.05, { r: 0.006 }), fx, y0, z0 + 0.025)); fr(at(bbox(0.05, hh, 0.05, { r: 0.006 }), fx, y0, z1 - 0.025));
  fr(at(bbox(0.04, 0.035, w.w, { r: 0.004 }), fx, y0 + hh * 0.52, w.z));
  fr(at(bbox(0.035, hh, 0.03, { r: 0.004 }), fx, y0, w.z));
  for (const k of [0.25, 0.78]) fr(at(bbox(0.03, 0.022, w.w, { r: 0.003 }), fx, y0 + hh * k, w.z));
  g.add(b.build('windowframe'));
  // the view outside: the live forest (render target) on a plane a little way behind the glass
  const view = new THREE.Mesh(new THREE.PlaneGeometry(w.w + 0.3, hh + 0.3), viewMat);
  view.rotation.y = Math.PI / 2;
  view.position.set(x - dep - 0.05, (y0 + y1) / 2, w.z);
  view.name = 'view';
  g.add(view);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w.w, hh), m.glass);
  glass.rotation.y = Math.PI / 2; glass.position.set(fx + 0.02, (y0 + y1) / 2, w.z);
  glass.renderOrder = 2;
  g.add(glass);
  // the venetian blinds: cream slats on ladder tapes under a head rail, hung inside the room's face of the reveal
  const n = 40, bx = x - 0.08, sh = (hh - 0.12) / n;
  const slatGeo = bbox(0.05, 0.004, w.w - 0.06, { r: 0.0015, center: true });
  const slats = new THREE.InstancedMesh(slatGeo, m.slat, n);
  slats.castShadow = true; slats.receiveShadow = true;
  slats.name = 'slats';
  const dummy = new THREE.Object3D();
  const tilt = (a: number) => {
    for (let i = 0; i < n; i++) {
      dummy.position.set(bx, y1 - 0.1 - i * sh, w.z);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      slats.setMatrixAt(i, dummy.matrix);
    }
    slats.instanceMatrix.needsUpdate = true;
  };
  tilt(0.6);
  g.add(slats);
  const hb = new Batch();
  hb.add(m.slat, at(bbox(0.07, 0.05, w.w - 0.02, { r: 0.008 }), bx, y1 - 0.07, w.z));
  for (const k of [-0.36, 0, 0.36]) {
    hb.add(m.cord, at(bbox(0.052, hh - 0.12, 0.012, { r: 0 }), bx, y0 + 0.04, w.z + k * w.w));
  }
  hb.add(m.slat, at(bbox(0.06, 0.02, w.w - 0.04, { r: 0.005 }), bx, y0 + 0.03, w.z));
  // the pull cord and its acorn (tilt wand)
  hb.add(m.cord, at(cyl(0.003, 0.9, 5), bx + 0.04, y1 - 0.95, z1 - 0.1));
  hb.add(m.brass, at(lathe([[0, 0], [0.012, 0.01], [0.014, 0.03], [0.006, 0.05], [0, 0.055]], 10), bx + 0.04, y1 - 1.0, z1 - 0.1));
  g.add(hb.build('blindrail'));
  return { group: g, view, slats, glassAt: V(fx, (y0 + y1) / 2, w.z), normal: V(1, 0, 0), tilt, opening: { y0, y1, z0, z1, x: fx } };
}

// ------------------------------------------------------------------ book spines (atlas) and shelves

/** An atlas of 32 spines (16 x 128 px each): binders with label windows, ledgers, cloth books with gilt bands. */
export function spineAtlas(): THREE.CanvasTexture {
  const W = 512, H = 128, t = new Tex(W, H);
  const cols: RGB[] = [rgb(0x1d2c52), rgb(0x5e1216), rgb(0x173621), rgb(0x2a2420), rgb(0x6b4a2a), rgb(0x24324a), rgb(0x7a2a1c), rgb(0x3a4a2a), rgb(0x1a1a1e), rgb(0x8a6a3a), rgb(0x2e5560), rgb(0x4a1e3a)];
  for (let i = 0; i < 32; i++) {
    const x0 = i * 16, c = cols[Math.floor(hash(i, 1, 3) * cols.length)], kind = i % 4;
    cloth(t, x0, 0, 16, H, c, { seed: i });
    if (kind === 0) {
      // a lever-arch binder: a white label window and a finger hole
      t.rect(x0 + 3, 20, 10, 38, (x, y) => lerpRamp(C.paper, 0.8 + (hash(x, y, i) - 0.5) * 0.1));
      for (let y = 26; y < 52; y += 4) t.rect(x0 + 5, y, 4 + Math.floor(hash(i, y, 2) * 3), 1, rgb(0x2a2a3a));
      t.rect(x0 + 3, 20, 10, 1, mul3(c, 0.6)); t.rect(x0 + 3, 57, 10, 1, mul3(c, 1.3));
      for (let y = 92; y < 102; y++) for (let x = x0 + 5; x < x0 + 11; x++) if (Math.hypot(x - x0 - 8, (y - 97) * 0.7) < 3.5) t.set(x, y, mul3(c, 0.35));
    } else if (kind === 1) {
      // a ledger: leather with raised bands and a red title label
      for (const y of [14, 30, 96, 112]) { t.rect(x0, y, 16, 3, mul3(c, 1.35)); t.rect(x0, y + 3, 16, 1, mul3(c, 0.6)); }
      t.rect(x0 + 2, 40, 12, 18, rgb(0x7a1b17));
      t.rect(x0 + 3, 41, 10, 1, lerpRamp(C.gilt, 0.8)); t.rect(x0 + 3, 56, 10, 1, lerpRamp(C.gilt, 0.8));
      for (let y = 45; y < 54; y += 3) t.rect(x0 + 4, y, 8, 1, lerpRamp(C.gilt, 0.6));
    } else {
      // cloth book: gilt bands and a title
      for (const y of [8, 11, 116, 119]) t.rect(x0 + 1, y, 14, 1, lerpRamp(C.gilt, 0.7));
      const ty = 24 + Math.floor(hash(i, 2, 5) * 30);
      for (let k = 0; k < 6; k++) t.rect(x0 + 5 + (k % 2), ty + k * 6, 5, 2, lerpRamp(C.gilt, 0.5 + hash(i, k, 6) * 0.3));
    }
    // worn edges
    for (let y = 0; y < H; y++) { t.shade(x0, y, 0.7); t.shade(x0 + 15, y, 0.75); t.shade(x0 + 1, y, 1.1); }
    for (let x = x0; x < x0 + 16; x++) { t.shade(x, 0, 0.7); t.shade(x, H - 1, 0.7); }
  }
  return t.texture({ repeat: false, q: 56 });
}

/** A row of books standing on a shelf from x0 to x1 (local), spines facing +z. */
function bookRow(spines: THREE.Material, pages: THREE.Material, cover: THREE.Material, x0: number, x1: number, y: number, z: number, depth: number, maxH: number, seed: number) {
  const out: { spine: THREE.BufferGeometry[]; page: THREE.BufferGeometry[]; cover: THREE.BufferGeometry[] } = { spine: [], page: [], cover: [] };
  let x = x0, i = 0;
  while (x < x1 - 0.03) {
    const r = hash(seed, i, 7);
    if (r > 0.93 && x < x1 - 0.25) { x += 0.06 + r * 0.05; i++; continue; } // a gap
    const kind = Math.floor(hash(seed, i, 3) * 32);
    const isBinder = kind % 4 === 0, isLedger = kind % 4 === 1;
    const w = isBinder ? 0.07 : isLedger ? 0.055 : 0.03 + hash(seed, i, 9) * 0.03;
    const h = Math.min(maxH, isBinder ? 0.32 : isLedger ? 0.36 : 0.22 + hash(seed, i, 11) * 0.1);
    if (x + w > x1) break;
    const d = Math.min(depth, isBinder ? 0.28 : 0.2 + hash(seed, i, 13) * 0.06);
    const lean = i > 0 && hash(seed, i, 17) > 0.94 ? 0.08 : 0;
    // spine face: a plane with UVs into its atlas tile
    const sp = new THREE.PlaneGeometry(w, h);
    const uv = sp.attributes.uv as THREE.BufferAttribute;
    const u0 = kind / 32, u1 = (kind + 1) / 32, vs = Math.min(1, h / 0.36);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? (1 + vs) / 2 : (1 - vs) / 2);
    sp.translate(0, h / 2, 0);
    out.spine.push(at(sp, x + w / 2, y, z + 0.0005, 0, 0, lean));
    // the block: cover on the sides, pages on top
    const blk = bbox(w, h, d, { r: 0.002, along: 'y' });
    out.cover.push(at(blk, x + w / 2, y, z - d / 2, 0, 0, lean));
    out.page.push(at(bbox(w * 0.8, 0.004, d * 0.95, { r: 0 }), x + w / 2, y + h - 0.002, z - d / 2 - 0.004, 0, 0, lean));
    x += w + 0.002 + (lean ? 0.02 : 0);
    i++;
  }
  return out;
}

export function buildShelves(m: OfficeMats, spineTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  g.name = 'shelves';
  const b = new Batch();
  const spines = mat({ map: spineTex, roughness: 0.75, name: 'spines' });
  const coverMat = mat({ color: 0x3a2418, roughness: 0.8 });
  const books: THREE.BufferGeometry[] = [], pages: THREE.BufferGeometry[] = [], covers: THREE.BufferGeometry[] = [];
  const D = L.shelfD, Hh = L.shelfH, z = L.z0;
  L.shelves.forEach((s, si) => {
    const w = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2;
    // carcass: sides, back, top cornice, a cupboard base with panelled doors
    b.add(m.mahogany, at(bbox(0.04, Hh, D, { r: 0.004, along: 'y' }), s.x0 + 0.02, 0, z + D / 2));
    b.add(m.mahogany, at(bbox(0.04, Hh, D, { r: 0.004, along: 'y' }), s.x1 - 0.02, 0, z + D / 2));
    const mid = cx;
    b.add(m.mahogany, at(bbox(0.035, Hh - 0.85, D - 0.02, { r: 0.004, along: 'y' }), mid, 0.85, z + D / 2));
    b.add(m.mahoganyDark, at(bbox(w, Hh - 0.85, 0.02, { r: 0, along: 'y' }), cx, 0.85, z + 0.01));
    b.add(m.mahoganyDark, at(bbox(w + 0.08, 0.06, D + 0.06, { r: 0.012 }), cx, Hh, z + D / 2 + 0.01));
    b.add(m.mahogany, at(bbox(w + 0.12, 0.08, D + 0.1, { r: 0.015 }), cx, Hh + 0.06, z + D / 2 + 0.02));
    b.add(m.mahoganyDark, at(bbox(w + 0.04, 0.04, D + 0.03, { r: 0.008 }), cx, Hh - 0.04, z + D / 2));
    // the cupboard
    b.add(m.mahogany, at(bbox(w, 0.85, D, { r: 0.006 }), cx, 0, z + D / 2));
    b.add(m.mahoganyDark, at(bbox(w + 0.04, 0.05, D + 0.04, { r: 0.012 }), cx, 0.85, z + D / 2 + 0.01));
    const doors = Math.round(w / 0.5);
    for (let i = 0; i < doors; i++) {
      const dx = s.x0 + (w / doors) * (i + 0.5), dw = w / doors - 0.04;
      b.add(m.mahogany, at(bbox(dw, 0.7, 0.02, { r: 0.006, along: 'y' }), dx, 0.1, z + D + 0.01));
      b.add(m.mahogany, at(bbox(dw - 0.12, 0.5, 0.02, { r: 0.012, along: 'y' }), dx, 0.2, z + D + 0.02));
      b.add(m.brass, at(lathe([[0, 0], [0.012, 0.004], [0.01, 0.02], [0, 0.024]], 8), dx + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.5, z + D + 0.02, Math.PI / 2, 0, 0));
    }
    b.add(m.mahoganyDark, at(bbox(w, 0.1, 0.03, { r: 0.006 }), cx, 0, z + D + 0.015));
    // shelves and their books
    const ys = [0.9, 1.35, 1.8, 2.25];
    ys.forEach((y, k) => {
      b.add(m.mahogany, at(bbox(w - 0.06, 0.03, D - 0.03, { r: 0.004 }), cx, y - 0.03, z + D / 2));
      for (const [a, c] of [[s.x0 + 0.05, mid - 0.025], [mid + 0.025, s.x1 - 0.05]] as [number, number][]) {
        const seed = si * 31 + k * 7 + (a < mid ? 0 : 3);
        // some runs hold an ornament instead of books on one end
        const r = bookRow(spines, m.paperStack, coverMat, a, c - (hash(seed, 4, 4) > 0.5 ? 0.22 : 0.02), y, z + D - 0.02, D - 0.06, (ys[k + 1] ?? Hh - 0.04) - y - 0.04, seed);
        books.push(...r.spine); pages.push(...r.page); covers.push(...r.cover);
      }
    });
  });
  const bb = new Batch();
  bb.add(spines, ...books); bb.add(m.paperStack, ...pages); bb.add(coverMat, ...covers);
  g.add(b.build('carcass'), bb.build('books'));
  return g;
}

// ------------------------------------------------------------------ the desk

export function buildDesk(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'desk';
  const { w, d, h } = L.desk;
  const b = new Batch();
  const top = 0.05, pw = 0.56, ph = h - top;
  // the top: a moulded mahogany slab with a tooled leather inlay
  b.add(m.mahogany, at(bbox(w, top * 0.6, d, { r: 0.012 }), 0, h - top * 0.6, 0));
  b.add(m.mahoganyDark, at(bbox(w - 0.03, top * 0.45, d - 0.03, { r: 0.01 }), 0, h - top, 0));
  const inlay = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, d - 0.16), m.deskLeather);
  inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, h + 0.0012, 0);
  inlay.receiveShadow = true;
  inlay.name = 'inlay';
  // pedestals
  for (const sx of [-1, 1]) {
    const px = sx * (w / 2 - pw / 2 - 0.03);
    b.add(m.mahogany, at(bbox(pw, ph - 0.1, d - 0.08, { r: 0.008, along: 'y' }), px, 0.1, 0));
    b.add(m.mahoganyDark, at(bbox(pw + 0.03, 0.1, d - 0.05, { r: 0.01 }), px, 0, 0));
    b.add(m.mahogany, at(bbox(pw + 0.04, 0.03, d - 0.04, { r: 0.008 }), px, 0.1, 0));
    // three drawers on Pip's side, raised panels on the visitor's side and the outer end
    const dh = (ph - 0.16) / 3;
    for (let i = 0; i < 3; i++) {
      const y = 0.14 + i * dh;
      b.add(m.mahogany, at(bbox(pw - 0.05, dh - 0.02, 0.02, { r: 0.008 }), px, y, -(d - 0.08) / 2 - 0.008));
      b.add(m.brass, at(bbox(0.12, 0.012, 0.01, { r: 0.004 }), px, y + dh / 2 - 0.006, -(d - 0.08) / 2 - 0.024));
      for (const ex of [-0.06, 0.06]) b.add(m.brass, at(cyl(0.01, 0.012, 8), px + ex, y + dh / 2, -(d - 0.08) / 2 - 0.02, -Math.PI / 2, 0, 0));
    }
    b.add(m.mahogany, at(bbox(pw - 0.08, ph - 0.3, 0.02, { r: 0.014, along: 'y' }), px, 0.2, (d - 0.08) / 2 + 0.008));
    b.add(m.mahoganyDark, at(bbox(pw - 0.16, ph - 0.4, 0.015, { r: 0.012, along: 'y' }), px, 0.25, (d - 0.08) / 2 + 0.022));
    b.add(m.mahogany, at(bbox(0.02, ph - 0.3, d - 0.2, { r: 0.012, along: 'y' }), px + sx * (pw / 2 + 0.008), 0.2, 0));
  }
  // the modesty panel on the visitor's side, the frieze drawer on Pip's side
  const kw = w - 2 * pw - 0.06;
  b.add(m.mahogany, at(bbox(kw, ph - 0.25, 0.03, { r: 0.006, along: 'y' }), 0, 0.25, (d - 0.08) / 2 - 0.02));
  b.add(m.mahoganyDark, at(bbox(kw - 0.14, ph - 0.4, 0.02, { r: 0.012, along: 'y' }), 0, 0.32, (d - 0.08) / 2));
  b.add(m.mahogany, at(bbox(kw, 0.12, d - 0.08, { r: 0.006 }), 0, ph - 0.12, 0));
  b.add(m.brass, at(bbox(0.16, 0.012, 0.01, { r: 0.004 }), 0, ph - 0.065, -(d - 0.08) / 2 - 0.006));
  const grp = b.build('desk');
  g.add(grp, inlay);
  return g;
}

// ------------------------------------------------------------------ the chair: a tufted oxblood wingback

export function buildChair(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'chair';
  const b = new Batch();
  const sw = 0.78, sd = 0.66, seat = L.seat;
  // legs and the seat rail
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.add(m.mahoganyDark, at(lathe([[0.026, 0], [0.03, 0.02], [0.024, 0.08], [0.028, 0.14], [0.03, 0.16], [0, 0.16]], 10), lx * (sw / 2 - 0.05), 0, lz * (sd / 2 - 0.05)));
    b.add(m.brass, at(cyl(0.028, 0.012, 10), lx * (sw / 2 - 0.05), 0, lz * (sd / 2 - 0.05)));
  }
  b.add(m.chairPlain, at(bbox(sw, 0.2, sd, { r: 0.04 }), 0, 0.16, 0));
  // seat cushion
  b.add(m.chairPlain, at(bbox(sw - 0.16, 0.14, sd - 0.1, { r: 0.05 }), 0, seat - 0.14, 0.03));
  // the back: tall, tufted on the front face, a rolled top
  const back = new THREE.BoxGeometry(sw - 0.04, 1.0, 0.16, 1, 1, 1);
  back.translate(0, 0.5, 0);
  b.add(m.chairPlain, at(bbox(sw - 0.02, 1.02, 0.14, { r: 0.04 }), 0, seat - 0.1, -sd / 2 + 0.04));
  const tuft = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.22, 0.86), m.chairLeather);
  tuft.position.set(0, seat + 0.42, -sd / 2 + 0.115);
  tuft.rotation.x = -0.06;
  b.add(m.chairPlain, at(cyl(0.085, sw + 0.02, 14), -(sw + 0.02) / 2, seat + 0.9, -sd / 2 + 0.05, 0, 0, -Math.PI / 2));
  // wings and rolled arms
  for (const sx of [-1, 1]) {
    b.add(m.chairPlain, at(bbox(0.12, 0.62, sd * 0.8, { r: 0.05 }), sx * (sw / 2 - 0.02), seat + 0.25, -0.06));
    b.add(m.chairPlain, at(bbox(0.13, 0.32, sd - 0.04, { r: 0.04 }), sx * (sw / 2 - 0.03), 0.3, 0.0));
    b.add(m.chairPlain, at(cyl(0.075, sd, 12), sx * (sw / 2 - 0.03), seat + 0.18, sd / 2, Math.PI / 2, 0, 0));
    // brass nailheads along the arm fronts
    for (let k = 0; k < 7; k++) b.add(m.brass, at(new THREE.SphereGeometry(0.008, 6, 4), sx * (sw / 2 - 0.03) + Math.cos(k / 6 * Math.PI) * 0.06, seat + 0.18 + Math.sin(k / 6 * Math.PI) * 0.06, sd / 2 + 0.002));
  }
  const grp = b.build('chair');
  tuft.castShadow = true; tuft.receiveShadow = true;
  g.add(grp, tuft);
  return g;
}

// ------------------------------------------------------------------ the credenza behind Pip

export function buildCredenza(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'credenza';
  const { w, d, h } = L.cred, b = new Batch();
  b.add(m.mahogany, at(bbox(w, h - 0.12, d - 0.04, { r: 0.008 }), 0, 0.1, 0));
  b.add(m.mahoganyDark, at(bbox(w + 0.02, 0.1, d - 0.02, { r: 0.01 }), 0, 0, 0));
  b.add(m.mahogany, at(bbox(w + 0.06, 0.04, d + 0.02, { r: 0.012 }), 0, h - 0.04, 0));
  for (let i = 0; i < 3; i++) {
    const dx = -w / 2 + (w / 3) * (i + 0.5), dw = w / 3 - 0.05;
    b.add(m.mahogany, at(bbox(dw, h - 0.26, 0.02, { r: 0.01, along: 'y' }), dx, 0.16, d / 2 - 0.01));
    b.add(m.mahoganyDark, at(bbox(dw - 0.12, h - 0.4, 0.015, { r: 0.012, along: 'y' }), dx, 0.23, d / 2 + 0.005));
    b.add(m.brass, at(lathe([[0, 0], [0.013, 0.004], [0.011, 0.02], [0, 0.024]], 8), dx + dw / 2 - 0.05, h * 0.55, d / 2, Math.PI / 2, 0, 0));
  }
  g.add(b.build('credenza'));
  return g;
}

// ------------------------------------------------------------------ filing cabinets (right wall)

export function buildCabinets(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cabinets';
  const b = new Batch();
  const cw = 0.5, cd = 0.62, ch = 1.32;
  const labels = new Tex(64, 16);
  paperFill(labels, 0, 0, 64, 16, { base: 0.85 });
  const lc = labels.canvas();
  const lg = lc.getContext('2d')!;
  const lt = new THREE.CanvasTexture(lc);
  void lg;
  for (let k = 0; k < 2; k++) {
    const z = L.cabinets.z + (k - 0.5) * (cw + 0.02);
    b.add(m.oak, at(bbox(cd, ch - 0.06, cw, { r: 0.008, along: 'y' }), 0, 0.06, z));
    b.add(m.walnut, at(bbox(cd + 0.01, 0.06, cw + 0.01, { r: 0.008 }), 0, 0, z));
    b.add(m.walnut, at(bbox(cd + 0.03, 0.03, cw + 0.03, { r: 0.008 }), 0, ch, z));
    for (let i = 0; i < 4; i++) {
      const y = 0.1 + i * 0.3;
      b.add(m.oak, at(bbox(0.02, 0.27, cw - 0.04, { r: 0.008, along: 'z' }), -cd / 2 - 0.008, y, z));
      // brass label holder and cup pull
      b.add(m.brass, at(bbox(0.006, 0.035, 0.09, { r: 0.002 }), -cd / 2 - 0.02, y + 0.19, z));
      b.add(m.ivory, at(bbox(0.004, 0.024, 0.075, { r: 0 }), -cd / 2 - 0.022, y + 0.195, z));
      b.add(m.brass, at(bbox(0.02, 0.025, 0.1, { r: 0.008 }), -cd / 2 - 0.025, y + 0.1, z));
    }
  }
  lt.dispose();
  g.add(b.build('cabinets'));
  g.position.set(L.cabinets.x, 0, 0);
  return g;
}

// ------------------------------------------------------------------ frames: real paintings and certificates

export function frame(m: OfficeMats, w: number, h: number, face: THREE.Material, o: { mould?: number; mat?: THREE.Material; mount?: number; mountMat?: THREE.Material } = {}): THREE.Group {
  const g = new THREE.Group();
  const k = o.mould ?? 0.06, fm = o.mat ?? m.gilt, b = new Batch();
  const ow = w + k * 2, oh = h + k * 2, mt = o.mount ?? 0;
  // a stepped moulding: outer bead, a hollow, an inner lip
  for (const [dw, dh, dz, t] of [[0, 0, 0, 0.035], [-0.02, -0.02, 0.012, 0.03]] as [number, number, number, number][]) {
    b.add(fm, at(bbox(ow + dw, k * 0.6, t, { r: 0.006, center: true }), 0, (oh + dh) / 2 - k * 0.3, dz));
    b.add(fm, at(bbox(ow + dw, k * 0.6, t, { r: 0.006, center: true }), 0, -(oh + dh) / 2 + k * 0.3, dz));
    b.add(fm, at(bbox(k * 0.6, oh + dh, t, { r: 0.006, center: true }), (ow + dw) / 2 - k * 0.3, 0, dz));
    b.add(fm, at(bbox(k * 0.6, oh + dh, t, { r: 0.006, center: true }), -(ow + dw) / 2 + k * 0.3, 0, dz));
  }
  if (mt > 0) b.add(o.mountMat ?? m.ivory, at(bbox(w + 0.002, h + 0.002, 0.006, { r: 0, center: true }), 0, 0, 0.0));
  g.add(b.build('frame'));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - mt * 2, h - mt * 2), face);
  pic.position.z = 0.0045;
  pic.receiveShadow = true;
  g.add(pic);
  return g;
}

/** A certificate, printed (canvas): an engraved border, a seal, the text. */
export function certificate(title: string, lines: string[], seal: RGB = rgb(0xa8242a)): THREE.CanvasTexture {
  const W = 192, H = 140, t = new Tex(W, H);
  paperFill(t, 0, 0, W, H, { base: 0.8, tone: C.paper });
  const ink = rgb(0x24304e);
  // guilloche border: two rules and a wave between
  for (let x = 6; x < W - 6; x++) { t.set(x, 6, ink); t.set(x, H - 7, ink); t.set(x, 10 + Math.round(Math.sin(x * 0.5) * 1.5), mix3(ink, C.paper[3], 0.4)); t.set(x, H - 11 + Math.round(Math.sin(x * 0.5) * 1.5), mix3(ink, C.paper[3], 0.4)); t.set(x, 14, ink); t.set(x, H - 15, ink); }
  for (let y = 6; y < H - 6; y++) { t.set(6, y, ink); t.set(W - 7, y, ink); t.set(10 + Math.round(Math.sin(y * 0.5) * 1.5), y, mix3(ink, C.paper[3], 0.4)); t.set(W - 11 + Math.round(Math.sin(y * 0.5) * 1.5), y, mix3(ink, C.paper[3], 0.4)); t.set(14, y, ink); t.set(W - 15, y, ink); }
  // the seal: a red wax rosette with ribbons
  const sx = W - 36, sy = H - 34;
  for (let y = -14; y <= 22; y++) for (let x = -14; x <= 14; x++) {
    const d = Math.hypot(x, y), a = Math.atan2(y, x);
    if (d < 11 + Math.sin(a * 12) * 1.2) t.set(sx + x, sy + y, mul3(seal, d < 7 ? 1.15 - d * 0.02 : 0.85));
    else if (y > 6 && Math.abs(x - (y - 6) * 0.4) < 2.5 && y < 22) t.set(sx + x, sy + y, mul3(seal, 0.7));
    else if (y > 6 && Math.abs(x + (y - 6) * 0.4) < 2.5 && y < 22) t.set(sx + x, sy + y, mul3(seal, 0.7));
  }
  const c = t.canvas(64), g = c.getContext('2d')!;
  crispText(g, title, W / 2, 36, F.caps(16), hexCSS(ink), { align: 'center' });
  lines.forEach((l, i) => crispText(g, l, W / 2, 56 + i * 18, i === 1 ? F.hand(16) : F.small(16), hexCSS(i === 1 ? rgb(0x1a1a3a) : ink), { align: 'center' }));
  // signatures
  crispText(g, 'Oakley', 41, H - 22, F.hand(16), '#1c2340', { align: 'center' });
  for (let x = 20; x < 62; x++) g.fillRect(x, H - 19, 1, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
  return tex;
}
