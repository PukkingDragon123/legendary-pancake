// The office's owl cuckoo clock: the very clock from the loading screen, the real 3D model (src/world/stages/cuckoo.ts,
// bare and plain, as src/onboard/clockbake.ts renders it for the loading screen) hung on the wall at 0.45 scale, so
// one em of the loading clock is CLOCK_PX metres here and the dive into its dial hands over to the opening shot (the
// camera nose to this dial, pulling back into the room). The hands keep the real time, the brass pendulum swings,
// and the pine-cone weights hang where the loading screen left them.
import * as THREE from 'three';
import { CLOCK_PLAN as C, CuckooStage } from '../world/stages/cuckoo.ts';
import { FINISHES } from '../world/stages/cuckookit.ts';
import type { OfficeMats } from './mats.ts';

/** metres (office) per em of the loading clock (1/150 m of the model) */
export const CLOCK_PX = 0.003;
const SCALE = CLOCK_PX * 150;
/** the model's lowest point of the case (the apron's tip): the group's origin */
const FOOT = -0.183;
/** the pendulum's beat (s) and swing (rad), as on the loading screen */
const BEAT = 1.6, SWING = 0.11;

export class WallClock {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  /** the dial centre in group space */
  readonly dial = new THREE.Vector3(0, (C.DIAL.y - FOOT) * SCALE, (C.CD + 0.0125) * SCALE);
  /** minutes after midnight to show (null: the real time) */
  at: number | null = null;
  spin = 0;
  private st: CuckooStage;

  constructor(_m: OfficeMats) {
    this.group.name = 'clock';
    const st = this.st = new CuckooStage(null, { finish: FINISHES[0].id, mute: true, wound: [Date.now(), Date.now()] }, { bare: true, plain: true });
    st.setDrop(0.9);
    const inner = new THREE.Group();
    inner.add(...st.scene.children);
    inner.scale.setScalar(SCALE);
    inner.position.y = -FOOT * SCALE;
    inner.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).visible === false) m.visible = false; });
    this.group.add(inner);
    this.ready = st.ready;
  }

  /** the size of one em of the loading clock here, in metres (for matching the loading screen's zoom) */
  get pxSize() { return CLOCK_PX; }

  update(dt: number, t: number) {
    const now = new Date();
    const mins = this.at ?? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * (1.2 + this.spin * 2.2));
    const p = this.st.parts;
    p.minute.rotation.z = -(((mins % 60) / 60) * Math.PI * 2 + this.spin * 12);
    p.hour.rotation.z = -((((mins / 60) % 12) / 12) * Math.PI * 2 + this.spin);
    p.pend.rotation.z = Math.sin((t / BEAT) * Math.PI * 2) * SWING;
  }
}
