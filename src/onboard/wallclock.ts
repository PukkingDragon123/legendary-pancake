// The office's carved cuckoo clock: the very clock from the loading screen. Its face is the loading clock's own
// painting (public/models/interview/clock.png, written by tools/bootart.mjs), set on a real walnut case with depth (a
// gabled box under a roof whose boards reach back to the wall); the hands and the leaf pendulum move, and the
// pine-cone weights hang on their chains where the loading screen left them. The opening shot starts with the
// camera nose to its dial (where the loading screen dived in) and pulls back into the room.
import * as THREE from 'three';
import { modelUrl } from '../gfx/glb.ts';
import { CLOCK_ART as A } from './clockart.gen.ts';
import { at, Batch, bbox } from './kit.ts';
import type { OfficeMats } from './mats.ts';

/** metres per art pixel */
export const CLOCK_PX = 0.003;
const P = CLOCK_PX, DEPTH = 0.15;
/** art px (x right, y down) -> clock space (x right, y up, origin at the bottom centre of the case painting) */
const X = (x: number) => (x - A.CX) * P, Y = (y: number) => (A.H - y) * P;
/** the pendulum's beat (s) and swing (rad), as on the loading screen */
const BEAT = 1.2, SWING = 0.15;

export class WallClock {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  /** the dial centre in group space */
  readonly dial = new THREE.Vector3(0, Y(A.DY), DEPTH);
  /** minutes after midnight to show (null: the real time) */
  at: number | null = null;
  spin = 0;
  private hour = new THREE.Group();
  private minute = new THREE.Group();
  private pend = new THREE.Group();
  private tex: THREE.Texture;

  constructor(m: OfficeMats) {
    const g = this.group;
    g.name = 'clock';
    this.tex = new THREE.Texture();
    this.ready = new Promise((res) => {
      new THREE.TextureLoader().load(modelUrl('interview/clock.png'), (t) => {
        this.tex.image = t.image; this.tex.needsUpdate = true; res();
      }, undefined, () => res());
    });
    const t = this.tex;
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
    const [AW, AH] = A.atlas;
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
    /** a plane showing an atlas rect, w x h art px, pivoting at (px, py) inside the rect (art px from its top-left) */
    const sprite = (r: readonly number[], o: { pivot?: [number, number]; shadow?: boolean } = {}) => {
      const [rx, ry, rw, rh] = r;
      const geo = new THREE.PlaneGeometry(rw * P, rh * P);
      const piv = o.pivot ?? [rw / 2, rh / 2];
      geo.translate((rw / 2 - piv[0]) * P, -(rh / 2 - piv[1]) * P, 0);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / AW, 1 - (ry + (1 - uv.getY(i)) * rh) / AH);
      const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.42, metalness: 0, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.22 });
      const mesh = new THREE.Mesh(geo, mat);
      if (o.shadow) { mesh.castShadow = true; mesh.customDepthMaterial = depthMat; }
      return mesh;
    };
    /** a sprite placed by its top-left corner on the painting's grid (art px), at depth z */
    const place = (r: readonly number[], x: number, y: number, z: number, shadow = true) => {
      const s = sprite(r, { pivot: [0, 0], shadow });
      s.position.set(X(x), Y(y), z);
      g.add(s);
      return s;
    };

    // the case: a gabled walnut box under a roof whose boards run back to the wall; mouldings round it
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const { ridge, slope, t: rt, eave } = A.roof;
    const roofY = (dx: number) => ridge + Math.abs(dx) * slope;
    const prism = (pts: [number, number][], d: number) => {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(X(x), Y(y))));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 1 });
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
      const me = new THREE.Mesh(geo, [hidden, m.walnut]);
      me.castShadow = true; me.receiveShadow = true;
      g.add(me);
      return me;
    };
    const cx = A.CX, gw = A.gable;
    prism([[cx - eave, roofY(eave)], [cx - eave, roofY(eave) + rt - 2], [cx, ridge + rt - 2], [cx + eave, roofY(eave) + rt - 2], [cx + eave, roofY(eave)], [cx, ridge]], DEPTH - 0.002);
    prism([[cx - gw, A.bot[2]], [cx + gw, A.bot[2]], [cx + gw, roofY(gw) + rt - 2], [cx, ridge + rt], [cx - gw, roofY(gw) + rt - 2]], DEPTH - 0.004);
    const b = new Batch();
    for (const [hw, y0, y1] of [A.corn, A.bot]) b.add(m.walnut, at(bbox(hw * 2 * P, (y1 - y0) * P, DEPTH - 0.002, { r: 0.003 }), 0, Y(y1), (DEPTH - 0.002) / 2));
    g.add(b.build('clockCase'));

    // the painted front
    const front = sprite(A.case, { shadow: true });
    front.position.set(0, Y(A.H / 2), DEPTH + 0.0008);
    front.receiveShadow = true;
    g.add(front);

    // the leaf pendulum hangs at the back; the weights and the rings hang in front of it on their chains
    const [pbx, pby] = A.pendBox, [pvx, pvy] = A.pivot;
    this.pend.add(sprite(A.pend, { pivot: [pvx - pbx, pvy - pby], shadow: true }));
    this.pend.position.set(X(pvx), Y(pvy), 0.05);
    g.add(this.pend);
    const top = A.bot[1];
    const ends = [...A.cones.map(([x, y]) => ({ r: A.cone, x, y, cx: x + 7 })), ...A.rings.map(([x, y]) => ({ r: A.ring, x, y, cx: x + 4 }))];
    ends.forEach((e, i) => {
      const z = 0.085 + i * 0.004;
      place(e.r, e.x, e.y, z);
      const len = Math.min(A.chain[3], e.y + 1 - top);
      place([A.chain[0], A.chain[1] + A.chain[3] - len, 3, len], e.cx - 1, top, z - 0.002);
    });

    // hands and the arbor nut
    for (const [grp, r, dz] of [[this.hour, A.hour, 0.0022], [this.minute, A.minute, 0.0032]] as [THREE.Group, readonly number[], number][]) {
      grp.add(sprite(r));
      grp.position.set(X(A.CX), Y(A.DY), DEPTH + dz);
      g.add(grp);
    }
    const boss = sprite(A.boss);
    boss.position.set(X(A.CX), Y(A.DY), DEPTH + 0.0045);
    g.add(boss);
  }

  /** the dial's art pixel size in metres (for matching the loading screen's zoom) */
  get pxSize() { return P; }

  update(dt: number, t: number) {
    const now = new Date();
    const mins = this.at ?? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * (1.2 + this.spin * 2.2));
    // the hands step like the painted ones: 120 positions a turn
    const mf = Math.round(((mins % 60) / 60) * 120) / 120, hf = Math.round((((mins / 60) % 12) / 12) * 120) / 120;
    this.minute.rotation.z = -(mf * Math.PI * 2 + this.spin * 12);
    this.hour.rotation.z = -(hf * Math.PI * 2 + this.spin);
    this.pend.rotation.z = Math.sin((t * Math.PI * 2) / BEAT) * SWING;
  }
}
