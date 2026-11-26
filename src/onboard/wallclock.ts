// The office's carved cuckoo clock: the very clock from the loading screen. [clock12] Its face is painted at load by
// the loading clock's own painter (clockpaint.ts) and set on a real walnut case with depth (a gabled box under a roof
// whose boards reach back to the wall); the dial and the hands are painted finer for the opening shot, which starts
// with the camera nose to the dial (where the loading screen dived in) and pulls back into the room. The hands and the
// oak-leaf pendulum move; the pine-cone weights hang on their chains where the loading screen left them.
import * as THREE from 'three';
import { CASE_BOX, CX, G, HANDS, PEND_BOX, finish, layer, paintCase, paintBoss, paintChain, paintCone, paintDial, paintHand, paintPendulum, paintRing } from './clockpaint.ts';
import { at, Batch, bbox } from './kit.ts';
import type { OfficeMats } from './mats.ts';

/** metres per art unit (the loading screen's dive matches it, see Office.pullBack) */
export const CLOCK_PX = 0.003;
const P = CLOCK_PX, DEPTH = 0.15;
/** art units (x right, y down) -> clock space (x right, y up, origin at the bottom centre of the base moulding) */
const X = (x: number) => (x - CX) * P, Y = (y: number) => (G.base.y1 - y) * P;
/** the pendulum's beat (s) and swing (rad), as on the loading screen */
const BEAT = 1.2, SWING = 0.15;
/** px per art unit: the case and its parts, and the dial and hands (seen close in the opening shot) */
const RES = 6, RES_DIAL = 16;

export class WallClock {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  /** the dial centre in group space */
  readonly dial = new THREE.Vector3(0, Y(G.dial.y), DEPTH);
  /** minutes after midnight to show (null: the real time) */
  at: number | null = null;
  spin = 0;
  private hour = new THREE.Group();
  private minute = new THREE.Group();
  private pend = new THREE.Group();

  constructor(m: OfficeMats) {
    const g = this.group;
    g.name = 'clock';
    /** a painted plane: the art-unit box (x, y, w, h) at `res` px per unit, pivoting at art point (px, py) */
    const plane = (box: { x: number; y: number; w: number; h: number }, res: number, paint: (c: CanvasRenderingContext2D) => void, o: { pivot?: [number, number]; outline?: number; shadow?: boolean } = {}) => {
      const [c, cg] = layer(box.x, box.y, box.w, box.h, res);
      paint(cg);
      const tex = new THREE.CanvasTexture(o.outline ? finish(c, res, o.outline) : c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const [px, py] = o.pivot ?? [box.x + box.w / 2, box.y + box.h / 2];
      const geo = new THREE.PlaneGeometry(box.w * P, box.h * P);
      geo.translate((box.x + box.w / 2 - px) * P, -(box.y + box.h / 2 - py) * P, 0);
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.42, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 });
      const mesh = new THREE.Mesh(geo, mat);
      if (o.shadow !== false) { mesh.castShadow = true; mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 }); }
      if (!o.pivot) mesh.position.set(X(px), Y(py), 0);
      return mesh;
    };

    // the case: a gabled walnut box under a roof whose boards run back to the wall; mouldings round it
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const roofY = (dx: number) => G.ridge + Math.abs(dx) * G.slope, rt = G.band + G.barge * 0.6, eave = G.eave;
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
    const cx = CX, gw = G.gable.hw + 3;
    prism([[cx - eave, roofY(eave)], [cx - eave, roofY(eave) + rt], [cx, G.ridge + rt], [cx + eave, roofY(eave) + rt], [cx + eave, roofY(eave)], [cx, G.ridge]], DEPTH - 0.002);
    prism([[cx - G.box.hw, G.base.y1 - 1], [cx + G.box.hw, G.base.y1 - 1], [cx + G.box.hw, G.corn.y0], [cx + gw, G.corn.y0], [cx, G.gable.top], [cx - gw, G.corn.y0], [cx - G.box.hw, G.corn.y0]], DEPTH - 0.004);
    const b = new Batch();
    for (const z of [G.corn, G.base]) b.add(m.walnut, at(bbox((z.hw - 1.5) * 2 * P, (z.y1 - z.y0) * P, DEPTH - 0.002, { r: 0.003 }), 0, Y(z.y1), (DEPTH - 0.002) / 2));
    g.add(b.build('clockCase'));

    // the painted front, a finer dial over it
    const front = plane(CASE_BOX, RES, (c) => paintCase(c, { dial: false }), { outline: 1.15 });
    front.position.z = DEPTH + 0.0008;
    front.receiveShadow = true;
    g.add(front);
    const R = G.dial.bez + 0.5;
    const dial = plane({ x: CX - R, y: G.dial.y - R, w: R * 2, h: R * 2 }, RES_DIAL, (c) => paintDial(c), { shadow: false });
    dial.position.z = DEPTH + 0.0014;
    dial.receiveShadow = true;
    g.add(dial);

    // the oak-leaf pendulum hangs at the back; the weights and the rings hang in front of it on their chains
    this.pend.add(plane(PEND_BOX(), RES, (c) => paintPendulum(c), { pivot: [CX, G.pivot.y], outline: 1 }));
    this.pend.position.set(X(CX), Y(G.pivot.y), 0.05);
    g.add(this.pend);
    const wb = { x: CX - G.rx - 8, y: G.chainTop - 2, w: (G.rx + 8) * 2, h: G.wBot + 44 - G.chainTop };
    const weights = plane(wb, RES, (c) => {
      for (const sd of [-1, 1]) {
        paintChain(c, CX + sd * G.rx, G.chainTop, G.rTop - 2.6); paintRing(c, CX + sd * G.rx, G.rTop);
        paintChain(c, CX + sd * G.wx, G.chainTop, G.wBot + 0.5); paintCone(c, CX + sd * G.wx, G.wBot);
      }
    }, { outline: 0.8 });
    weights.position.z = 0.085;
    g.add(weights);

    // the hands (the minute hand carries the arbor nut)
    const HL = HANDS.minute + 2, hb = { x: CX - HL, y: G.dial.y - HL, w: HL * 2, h: HL * 2 };
    for (const [grp, kind, dz] of [[this.hour, 'hour', 0.0024], [this.minute, 'minute', 0.0034]] as [THREE.Group, 'hour' | 'minute', number][]) {
      grp.add(plane(hb, RES_DIAL, (c) => { paintHand(c, CX, G.dial.y, kind); if (kind === 'minute') paintBoss(c); }, { pivot: [CX, G.dial.y], shadow: false }));
      grp.position.set(X(CX), Y(G.dial.y), DEPTH + dz);
      g.add(grp);
    }
    this.ready = Promise.resolve();
  }

  /** the dial's art unit in metres (for matching the loading screen's zoom) */
  get pxSize() { return P; }

  update(dt: number, t: number) {
    const now = new Date();
    const mins = this.at ?? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * (1.2 + this.spin * 2.2));
    this.minute.rotation.z = -(((mins % 60) / 60) * Math.PI * 2 + this.spin * 12);
    this.hour.rotation.z = -((((mins / 60) % 12) / 12) * Math.PI * 2 + this.spin);
    this.pend.rotation.z = Math.sin((t * Math.PI * 2) / BEAT) * SWING;
  }
}
