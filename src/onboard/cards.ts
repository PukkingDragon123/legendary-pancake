// The live 3D models in the interview's answer cards: properly modelled props (borrowed CC0 / CC BY models, see
// docs/credits/intro4.md, packed into public/models/interview/cards_*.glb by tools/packglb.mjs), the game's own
// owls for the species page, the office's bracket clock (with real hands) for the wake-up page, and a tower of
// pillows that grows with your hours of sleep. Each comes framed for its card and gently alive.
import * as THREE from 'three';
import { loadGLB } from '../gfx/glb.ts';
import { OwlActor } from '../owl/actor.ts';
import type { OwlLook } from '../owl/model.ts';
import type { OfficeMats } from './mats.ts';
import type { SlotOpts } from './overlay3d.ts';
import { WallClock } from './wallclock.ts';

/** answer -> packed model node (and how to show it) */
const MAP: Record<string, { node: string; o?: SlotOpts; tint?: number; glow?: boolean }> = {
  'goals:sleep_better': { node: 'daybed', o: { pitch: 0.4 } },
  'goals:fall_asleep': { node: 'sheep', o: { pitch: 0.2 } },
  'goals:wake_refreshed': { node: 'alarm', o: { pitch: 0.2, yaw: 0.3 } },
  'goals:steady_routine': { node: 'watch', o: { pitch: 0.55 } },
  'goals:less_phone': { node: 'phone', o: { pitch: 0.7, zoom: 0.95 }, glow: true },
  'goals:track_sounds': { node: 'headphones', o: { pitch: 0.35 } },
  'latency:quick': { node: 'pillows', o: { pitch: 0.35 } },
  'latency:normal': { node: 'candles', o: { pitch: 0.15 } },
  'latency:slow': { node: 'sheep', o: { pitch: 0.2 } },
  'latency:long': { node: 'watch', o: { pitch: 0.55 } },
  'phone:never': { node: 'cabinet', o: { pitch: 0.2 } },
  'phone:sometimes': { node: 'nightstand', o: { pitch: 0.25 } },
  'phone:nightly': { node: 'phone', o: { pitch: 0.7, zoom: 0.95 }, glow: true },
  'chrono:lark': { node: 'alarm', o: { pitch: 0.2, yaw: 0.3 } },
  'chrono:between': { node: 'mug', o: { pitch: 0.4 }, tint: 0xd9c49a },
  'caffeine:none': { node: 'milk', o: { pitch: 0.2 } },
  'caffeine:morning': { node: 'mug', o: { pitch: 0.4 }, tint: 0xf3e2c4 },
  'caffeine:late': { node: 'teapot', o: { pitch: 0.35 } },
  'mic:yes': { node: 'headphones', o: { pitch: 0.35 } },
  'mic:no': { node: 'pillows', o: { pitch: 0.35 } },
  'relax:rain': { node: 'umbrellas', o: { pitch: 0.25 } },
  'relax:waves': { node: 'shell', o: { pitch: 0.5 } },
  'relax:forest': { node: 'pine', o: { pitch: 0.1 } },
  'relax:fire': { node: 'firepit', o: { pitch: 0.55 } },
  'relax:stream': { node: 'rocks', o: { pitch: 0.6 } },
  'relax:wind': { node: 'paperlantern', o: { pitch: 0.15 } },
  'relax:brown': { node: 'radio', o: { pitch: 0.2 } },
  'relax:lullaby': { node: 'gramophone', o: { pitch: 0.2 } },
  'relax:night': { node: 'lantern', o: { pitch: 0.15 } },
  'relax:breathing': { node: 'candles', o: { pitch: 0.15 } },
  'relax:reading': { node: 'books', o: { pitch: 0.3 } },
};
const PACKS = ['interview/cards_a.glb', 'interview/cards_b.glb'];

export class CardModels {
  private nodes = new Map<string, THREE.Object3D>();
  private owls = new Map<string, OwlActor>();
  readonly ready: Promise<void>;
  /** the wake page's clock shows this many minutes after midnight */
  clockAt = 7 * 60;
  constructor(private mats: OfficeMats, private look: (species: string) => OwlLook) {
    this.ready = Promise.all(PACKS.map((p) => loadGLB(p).then((g) => {
      for (const c of g.scene.children) this.nodes.set(c.name, c);
    }).catch((e) => console.warn('card models failed', p, e)))).then(() => undefined);
  }

  /** A fresh copy of a packed model, centred on its base. */
  private clone(node: string, tint?: number): THREE.Object3D | null {
    const src = this.nodes.get(node);
    if (!src) return null;
    const c = src.clone(true);
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    c.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(c), ctr = b.getCenter(new THREE.Vector3());
    const g = new THREE.Group();
    c.position.set(-ctr.x, -b.min.y, -ctr.z);
    g.add(c);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if ('roughness' in mat) { mat.roughness = Math.max(0.45, mat.roughness ?? 0.7); mat.metalness = Math.min(0.3, mat.metalness ?? 0); }
      if (tint !== undefined) mat.color.setHex(tint);
      m.material = mat;
    });
    return g;
  }

  /** The model for a card key: '<step>:<value>', 'owl:<species>', 'clock', 'pillows:<n>'. */
  model = (key: string): { obj: THREE.Object3D; opts?: SlotOpts } | null => {
    if (key.startsWith('owl:')) {
      const sp = key.slice(4);
      let a = this.owls.get(sp);
      if (!a) { a = new OwlActor({ ...this.look(sp), outfit: {} }); this.owls.set(sp, a); }
      const actor = a;
      const g = new THREE.Group();
      g.add(actor.node);
      actor.node.position.set(0, 0, 0);
      actor.node.scale.setScalar(1);
      actor.pose = 'stand';
      return { obj: g, opts: { pitch: 0.1, zoom: 0.78, lift: -0.05, spin: 0.4, yaw: 0.1, tick: (_o, _t, dt) => actor.update(dt) } };
    }
    if (key === 'clock') {
      const c = new WallClock(this.mats);
      const g = new THREE.Group();
      g.add(c.group);
      // frame the dial only
      const dial = c.dial.clone();
      const self = this;
      return { obj: g, opts: { pitch: 0, yaw: 0, spin: 0, zoom: 1, focus: { c: dial, r: 0.13 }, tick: (_o, t, dt) => { c.at = self.clockAt; c.update(dt, t); } } as SlotOpts };
    }
    if (key.startsWith('pillows:')) {
      const n = Math.max(4, Math.min(12, Number(key.slice(8)) || 8));
      const g = new THREE.Group();
      const one = this.clone('pillows');
      if (!one) return null;
      const h = new THREE.Box3().setFromObject(one).getSize(new THREE.Vector3()).y;
      for (let i = 0; i < n; i++) {
        const p = i ? this.clone('pillows')! : one;
        p.position.y = i * h * 0.55;
        p.rotation.y = Math.sin(i * 1.9) * 0.5;
        p.scale.setScalar(1 - i * 0.015);
        g.add(p);
      }
      return { obj: g, opts: { pitch: 0.25, spin: 0.3, yaw: 0.4 } };
    }
    const m = MAP[key];
    if (!m) return null;
    const obj = this.clone(m.node, m.tint);
    if (!obj) return null;
    let tick: SlotOpts['tick'];
    if (m.glow) {
      // the phone's screen lights up blue now and then (a notification at night)
      const screen = new THREE.PointLight(0x7fb8ff, 0, 1, 2);
      obj.add(screen);
      const b = new THREE.Box3().setFromObject(obj);
      screen.position.set(0, b.max.y + (b.max.y - b.min.y) * 0.6, 0);
      screen.distance = (b.max.y - b.min.y) * 6;
      tick = (_o, t) => { screen.intensity = (Math.sin(t * 2.2) > 0.4 ? 3 : 0.4) * (b.max.y - b.min.y + 0.1); };
    }
    if (m.node === 'sheep') tick = (o, t) => { o.position.y += Math.max(0, Math.sin(t * 5)) * 0.06 * o.scale.y; };
    if (m.node === 'songbird') tick = (o, t) => { const k = (t * 1.4) % 1; o.position.y += (k < 0.2 ? Math.sin((k / 0.2) * Math.PI) : 0) * 0.08 * o.scale.y; };
    return { obj, opts: { ...m.o, tick } };
  };

  dispose() { for (const a of this.owls.values()) a.dispose(); }
}
