// The office's bracket clock on its carved wall bracket: the very clock from the loading screen. Its face is the
// loading clock's own painting (public/models/interview/clock.png, written by tools/bootart.mjs), set in a real
// mahogany case with depth; the hands, the seconds, the moon disc and the pendulum move. The opening shot starts
// with the camera nose to its dial (where the loading screen dived in) and pulls back into the room.
import * as THREE from 'three';
import { modelUrl } from '../gfx/glb.ts';
import { CLOCK_ART as A } from './clockart.gen.ts';
import { at, Batch, bbox, lathe } from './kit.ts';
import type { OfficeMats } from './mats.ts';

/** metres per art pixel */
export const CLOCK_PX = 0.003;
const P = CLOCK_PX, DEPTH = 0.15;
/** art px (x right, y down) -> clock space (x right, y up, origin at the case's bottom centre) */
const X = (x: number) => (x - A.CX) * P, Y = (y: number) => (A.H - y) * P;

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
  private second = new THREE.Group();
  private moon = new THREE.Group();
  private pend = new THREE.Group();
  private tex: THREE.Texture;
  private lastSec = -1;

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
    /** a plane showing an atlas rect, w x h art px, pivoting at (px, py) inside the rect */
    const sprite = (r: readonly number[], o: { lit?: boolean; alpha?: 'test' | 'blend'; pivot?: [number, number] } = {}) => {
      const [rx, ry, rw, rh] = r;
      const geo = new THREE.PlaneGeometry(rw * P, rh * P);
      const piv = o.pivot ?? [rw / 2, rh / 2];
      geo.translate((rw / 2 - piv[0]) * P, -(rh / 2 - piv[1]) * P, 0);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / AW, 1 - (ry + (1 - uv.getY(i)) * rh) / AH);
      const mat = o.lit === false
        ? new THREE.MeshBasicMaterial({ map: t, transparent: o.alpha === 'blend', alphaTest: o.alpha === 'blend' ? 0 : 0.5, depthWrite: o.alpha !== 'blend', toneMapped: false })
        : new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.42, metalness: 0, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.22 });
      const mesh = new THREE.Mesh(geo, mat);
      return mesh;
    };
    // the case: walls following the painting's outline (the front is the painting itself), a back board
    const rows = A.rows as unknown as [number, number, number][];
    const shape = new THREE.Shape();
    rows.forEach(([y, x0], i) => (i ? shape.lineTo(X(x0), Y(y)) : shape.moveTo(X(x0), Y(y))));
    for (let i = rows.length - 1; i >= 0; i--) shape.lineTo(X(rows[i][2]), Y(rows[i][0]));
    shape.closePath();
    const walls = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 });
    // UVs along the walls in metres for the wood texture
    const wuv = walls.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < wuv.count; i++) wuv.setXY(i, wuv.getX(i) * 0.5, wuv.getY(i) * 0.5);
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const caseMesh = new THREE.Mesh(walls, [hidden, m.mahogany]);
    caseMesh.castShadow = true; caseMesh.receiveShadow = true;
    g.add(caseMesh);
    const back = new THREE.Mesh(new THREE.ShapeGeometry(shape), m.mahoganyDark);
    back.position.z = 0.002;
    g.add(back);
    // a dark well behind the moon window
    const well = new THREE.Mesh(new THREE.CircleGeometry(30 * P, 24), new THREE.MeshBasicMaterial({ color: 0x050812 }));
    well.position.set(X(A.moonAt[0]), Y(A.moonAt[1]), 0.02);
    g.add(well);
    // the moon disc turns behind the arch
    const disc = sprite(A.moon, { lit: false });
    this.moon.position.set(X(A.moonAt[0]), Y(A.moonAt[1]), DEPTH - 0.02);
    this.moon.add(disc);
    g.add(this.moon);
    // the painted front
    const front = sprite(A.case);
    front.position.set(0, Y(A.H / 2), DEPTH + 0.0004);
    front.castShadow = true; front.receiveShadow = true;
    front.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
    g.add(front);
    // the pendulum in its aperture (in front of the painted dark interior, behind the glass)
    const [pbx, pby] = A.pendBox, [pvx, pvy] = A.pivot;
    const pend = sprite(A.pend, { pivot: [pvx - pbx, pvy - pby] });
    this.pend.position.set(X(pvx), Y(pvy), DEPTH + 0.0012);
    this.pend.add(pend);
    g.add(this.pend);
    // hands, boss, glass
    const z = DEPTH;
    for (const [grp, r, dz] of [[this.hour, A.hour, 0.0022], [this.minute, A.minute, 0.0032], [this.second, A.second, 0.0042]] as [THREE.Group, readonly number[], number][]) {
      grp.add(sprite(r));
      grp.position.set(X(A.CX), Y(A.DY), z + dz);
      g.add(grp);
    }
    const boss = sprite(A.boss);
    boss.position.set(X(A.CX), Y(A.DY), z + 0.005);
    g.add(boss);
    const glass = sprite(A.glass, { lit: false, alpha: 'blend' });
    glass.position.set(0, Y(A.H / 2), z + 0.007);
    glass.renderOrder = 4;
    g.add(glass);

    // the carved wall bracket under it: a moulded shelf on two scroll corbels, brass lip
    const b = new Batch();
    b.add(m.mahogany, at(bbox(0.52, 0.03, 0.24, { r: 0.008 }), 0, -0.03, 0.12));
    b.add(m.mahoganyDark, at(bbox(0.5, 0.012, 0.22, { r: 0.004 }), 0, -0.042, 0.11));
    b.add(m.brass, at(bbox(0.522, 0.004, 0.004, { r: 0.0015 }), 0, -0.012, 0.242));
    for (const sx of [-1, 1]) {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector2(0.03 + Math.sin(k * Math.PI) * 0.035 + (1 - k) * 0.12, -k * 0.13)); }
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      for (const p of pts) sh.lineTo(p.x, p.y);
      sh.lineTo(0, -0.13); sh.closePath();
      const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
      cg.rotateY(-Math.PI / 2);
      b.add(m.mahogany, at(cg, sx * 0.16 + 0.02, -0.045, 0.0));
      b.add(m.brass, at(lathe([[0, 0], [0.008, 0.002], [0.006, 0.012], [0, 0.014]], 8), sx * 0.16, -0.17, 0.03, Math.PI, 0, 0));
    }
    const br = b.build('bracket');
    g.add(br);
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
    const sec = now.getSeconds();
    if (sec !== this.lastSec) { this.lastSec = sec; this.second.rotation.z = -(sec / 60) * Math.PI * 2; }
    this.pend.rotation.z = Math.sin((t * Math.PI * 2) / 1.1) * 0.2;
    this.moon.rotation.z = 0;
  }
}
