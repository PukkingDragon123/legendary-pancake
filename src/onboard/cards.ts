// The live 3D answer objects of the interview: the drinks, the cassette tapes and their recorder, pillows, a
// candle, a microphone, the sun and moon ornaments and the phones are modelled and hand-painted in code
// (props.ts); a day bed, the sheep, an alarm clock, a pocket watch and a nightstand are borrowed
// CC0 / CC BY models (docs/credits/intro4.md, intro5.md) packed into public/models/interview/cards.glb by
// tools/packglb.mjs; the owls are the game's own; the wake-up page turns the office's bracket clock. Each comes
// normalised (its largest side one unit, standing on its base at the origin) and gently alive.
import * as THREE from 'three';
import { loadGLB } from '../gfx/glb.ts';
import { OwlActor } from '../owl/actor.ts';
import type { OwlLook } from '../owl/model.ts';
import { PhoneScreen } from '../ui/phone/phone.tsx';
import type { OfficeMats } from './mats.ts';
import type { SlotOpts } from './overlay3d.ts';
import { bookStack, candle, cassette, celestial, deck, DRINKS, microphone, phoneBed, pillow, smartphone, stile, TAPES, type Deck, type Prop } from './props.ts';
import { WallClock } from './wallclock.ts';

/** packed GLB nodes and how to show them */
const NODES: Record<string, { node: string; o?: SlotOpts }> = {
  'goals:sleep_better': { node: 'daybed', o: { pitch: 0.42, yaw: 0.5 } },
  'goals:fall_asleep': { node: 'sheep', o: { pitch: 0.22, yaw: 0.9 } },
  'goals:wake_refreshed': { node: 'alarm', o: { pitch: 0.2, yaw: 0.25, sway: 0.3 } },
  'goals:steady_routine': { node: 'watch', o: { pitch: 0.55, yaw: 0.1, sway: 0.3 } },
  remind: { node: 'alarm', o: { pitch: 0.2, yaw: 0.25, sway: 0.25, shadow: true } },
};
const PACK = 'interview/cards.glb';

/** largest side one unit, standing on its base at the origin, wrapped in a group */
export function norm(src: THREE.Object3D, k0 = 1): THREE.Group {
  src.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(src), ctr = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  const k = k0 / Math.max(1e-6, sz.x, sz.y, sz.z);
  const g = new THREE.Group(), inner = new THREE.Group();
  inner.add(src);
  inner.scale.setScalar(k);
  inner.position.set(-ctr.x * k, -b.min.y * k, -ctr.z * k);
  g.add(inner);
  return g;
}
const fromProp = (p: Prop, o: SlotOpts = {}, k0 = 1): { obj: THREE.Object3D; opts: SlotOpts } => {
  const obj = norm(p.obj, k0);
  const tick = p.tick;
  return { obj, opts: { ...o, tick: tick ? (_o, t, dt) => tick(t, dt) : o.tick } };
};

export class CardModels {
  private nodes = new Map<string, THREE.Object3D>();
  private owls = new Map<string, OwlActor>();
  readonly ready: Promise<void>;
  /** the wake page's clock shows this many minutes after midnight */
  clockAt = 7 * 60;
  /** the night owl card shows the player's own owl */
  nightOwl = 'tawny';
  /** the cassette recorder on the sounds page (one at a time) */
  deck: Deck | null = null;
  /** the phone films (shared by the 3D phones' screens) */
  private screens: { s: PhoneScreen; tex: THREE.CanvasTexture | null; t: number }[] = [];
  wake = '07:00';
  hour12 = false;

  constructor(private mats: OfficeMats, private look: (species: string) => OwlLook) {
    this.ready = loadGLB(PACK).then((g) => {
      for (const c of g.scene.children) this.nodes.set(c.name, c);
    }).catch((e) => console.warn('card models failed', PACK, e));
  }

  /** A fresh copy of a packed model, normalised. */
  private clone(node: string): THREE.Group | null {
    const src = this.nodes.get(node);
    if (!src) return null;
    const c = src.clone(true);
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if ('roughness' in mat) { mat.roughness = Math.max(0.45, mat.roughness ?? 0.7); mat.metalness = Math.min(0.3, mat.metalness ?? 0); }
      m.material = mat;
    });
    return norm(c);
  }

  /** a smartphone whose screen plays the bedtime film from `at` seconds (static when `live` is false) */
  private phone(at: number | null, live: boolean, glow = 0) {
    if (at === null) return smartphone(null, 0);
    const s = new PhoneScreen(this.wake, this.hour12);
    s.draw(at);
    const p = smartphone(s.canvas, glow);
    const entry = { s, tex: null as THREE.CanvasTexture | null, t: at };
    this.screens.push(entry);
    const prev = p.tick;
    let acc = 0;
    p.tick = (t, dt) => {
      prev?.(t, dt);
      if (!live) return;
      acc += dt;
      if (acc < 1 / 8) return;
      entry.t = (entry.t + acc) % 5.6; acc = 0;
      entry.s.wake = this.wake; entry.s.hour12 = this.hour12;
      entry.s.draw(0.9 + entry.t);
      p.obj.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial; if (m && m.map && (m.map as THREE.CanvasTexture).isCanvasTexture && m.map.image === entry.s.canvas) m.map.needsUpdate = true; });
    };
    return p;
  }

  /** A fresh cassette for a tape id (the flight to the recorder). */
  tape(id: string) { const tp = TAPES.find((x) => x.id === id); return tp ? cassette(tp) : null; }

  /**
   * The model for a key: '<step>:<value>', 'drink:<id>', 'tape:<id>', 'deck', 'when:<morning|late>',
   * 'ampm:<am|pm>', 'owl:<species>', 'clock', 'pillows:<n>', 'remind'.
   */
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
      return { obj: g, opts: { pitch: 0.12, zoom: 0.8, lift: -0.04, spin: 0.4, yaw: 0.1, sway: 0.35, tick: (_o, _t, dt) => actor.update(dt) } };
    }
    if (key === 'clock') {
      const c = new WallClock(this.mats);
      const g = new THREE.Group();
      g.add(c.group);
      const dial = c.dial.clone();
      return { obj: g, opts: { pitch: 0, yaw: 0, spin: 0, sway: 0, zoom: 1, shadow: false, focus: { c: dial, r: 0.13 }, tick: (_o, t, dt) => { c.at = this.clockAt; c.update(dt, t); } } };
    }
    if (key.startsWith('pillows:')) {
      // one pillow per hour, stacked into a slightly wobbly tower, each in its own pillowcase
      const n = Math.max(1, Math.min(12, Math.round(Number(key.slice(8)) || 8)));
      const g = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const p = pillow(i);
        p.position.set(Math.sin(i * 2.3) * 0.025, i * 0.118, Math.sin(i * 1.7) * 0.02);
        p.rotation.y = Math.sin(i * 1.9) * 0.22;
        g.add(p);
      }
      return { obj: norm(g), opts: { pitch: 0.28, spin: 0.3, yaw: 0.35, sway: 0.2, zoom: 1.04, box: true } };
    }
    if (key.startsWith('drink:')) {
      const d = DRINKS.find((x) => x.v === key.slice(6));
      if (!d) return null;
      const small = d.v === 'espresso' ? 0.8 : d.v === 'tea' ? 0.9 : 1;
      return fromProp(d.build(), { pitch: 0.38, yaw: -0.35, sway: 0.18, spin: 0.6, zoom: 1.08 / small });
    }
    if (key.startsWith('tape:')) {
      const c = this.tape(key.slice(5));
      if (!c) return null;
      const r = fromProp(c, { pitch: 0.12, yaw: 0, sway: 0.12, spin: 0.8, zoom: 0.84, shadow: true });
      r.obj.rotation.x = -0.12;
      return r;
    }
    if (key === 'deck') {
      const d = deck();
      this.deck = d;
      return fromProp(d, { pitch: 0.18, yaw: -0.18, sway: 0.08, spin: 0.4, zoom: 0.84 });
    }
    if (key === 'when:morning' || key === 'ampm:am' || key === 'chrono:lark') return fromProp(celestial('sun'), { pitch: 0.1, yaw: 0, sway: 0, zoom: key === 'chrono:lark' ? 0.9 : 0.85 });
    if (key === 'when:late' || key === 'ampm:pm' || key === 'chrono:owl') return fromProp(celestial('moon'), { pitch: 0.1, yaw: 0, sway: 0, zoom: key === 'chrono:owl' ? 0.9 : 0.85 });
    if (key === 'chrono:between') return fromProp(celestial('dial'), { pitch: 0.1, yaw: 0, sway: 0, zoom: 0.9 });
    if (key === 'relax:reading') return fromProp(bookStack(), { pitch: 0.45, yaw: 0.4, sway: 0.25, zoom: 0.92 });
    if (key === 'relax:breathing') return fromProp(candle(), { pitch: 0.25, yaw: 0, sway: 0.1, zoom: 0.92 });
    if (key === 'goals:track_sounds' || key === 'mic:yes') return fromProp(microphone(false), { pitch: 0.15, yaw: 0.3, sway: 0.3, zoom: 0.9 });
    if (key === 'mic:no') return fromProp(microphone(true), { pitch: 0.15, yaw: 0.3, sway: 0.3, zoom: 0.9 });
    if (key === 'goals:less_phone' || key === 'phone:never') {
      const bed = phoneBed(this.phone(null, false).obj);
      return { obj: norm(bed), opts: { pitch: 0.62, yaw: 0.35, sway: 0.25, zoom: 0.95 } };
    }
    if (key === 'phone:sometimes') {
      const ns = this.clone('nightstand');
      if (!ns) return null;
      const ph = this.phone(2.2, false, 0.15);
      const top = new THREE.Box3().setFromObject(ns).max.y;
      const pg = norm(ph.obj, 0.36);
      pg.children[0].rotation.x = -Math.PI / 2;
      pg.position.set(0.05, top + 0.006, 0.05);
      pg.rotation.y = 0.4;
      const g = new THREE.Group();
      g.add(ns, pg);
      return { obj: g, opts: { pitch: 0.4, yaw: 0.35, sway: 0.25, zoom: 0.95, tick: ph.tick ? (_o, t, dt) => ph.tick!(t, dt) : undefined } };
    }
    if (key === 'phone:nightly') {
      // the phone on the pillow, its screen lighting up with notifications
      const g = new THREE.Group();
      const pl = pillow(0);
      g.add(pl);
      const ph = this.phone(1.0, true, 0.6);
      const pg = norm(ph.obj, 0.3);
      pg.children[0].rotation.x = -Math.PI / 2;
      pg.position.set(0.05, 0.135, 0.02);
      pg.rotation.y = -0.35;
      g.add(pg);
      return { obj: norm(g), opts: { pitch: 0.55, yaw: 0.3, sway: 0.2, zoom: 0.92, tick: ph.tick ? (_o, t, dt) => ph.tick!(t, dt) : undefined } };
    }
    if (key.startsWith('latency:')) {
      // counting sheep over a stile: one, two, four, a whole flock
      const n = { quick: 1, normal: 2, slow: 4, long: 7 }[key.slice(8)] ?? 1;
      const g = new THREE.Group();
      const st = stile();
      st.scale.setScalar(0.85);
      g.add(st);
      const sheep: THREE.Object3D[] = [];
      for (let i = 0; i < n; i++) { const s = this.clone('sheep'); if (!s) return null; s.scale.setScalar(0.85); s.rotation.y = Math.PI / 2; g.add(s); sheep.push(s); }
      const place = () => sheep.forEach((s, i) => { if (i === 0) return; const c = Math.floor((i - 1) / 2), r = (i - 1) % 2; s.position.set(-1.05 - c * 0.62, 0, r ? -0.42 : 0.3); });
      place();
      // the top of the jump, so the framing leaves room for it (invisible)
      const apex = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ visible: false }));
      apex.position.set(0, 1.3, 0);
      g.add(apex);
      const tick = (_o: THREE.Object3D, t: number) => {
        const k = (t * 0.45) % 1, s = sheep[0];
        s.position.set(-0.85 + k * 1.7, Math.sin(Math.min(1, Math.max(0, (k - 0.15) / 0.7)) * Math.PI) * 0.62, 0);
        s.rotation.z = (0.5 - k) * 0.5 * (k > 0.15 && k < 0.85 ? 1 : 0);
        for (let i = 1; i < sheep.length; i++) sheep[i].position.y = Math.max(0, Math.sin(t * 6 + i * 1.7)) * 0.04;
      };
      return { obj: norm(g), opts: { pitch: 0.25, yaw: 0.25, sway: 0.15, spin: 0.4, box: true, zoom: 1.02, tick } };
    }
    const m = NODES[key];
    if (!m) return null;
    const obj = this.clone(m.node);
    if (!obj) return null;
    let tick: SlotOpts['tick'];
    if (m.node === 'sheep') tick = (o, t) => { o.position.y += Math.max(0, Math.sin(t * 5)) * 0.06 * o.scale.y; };
    if (m.node === 'alarm') tick = (o, t) => { const ring = (t % 3) < 0.6; o.rotation.z = ring ? Math.sin(t * 60) * 0.04 : 0; };
    return { obj, opts: { ...m.o, tick } };
  };

  dispose() { for (const a of this.owls.values()) a.dispose(); this.screens.length = 0; }
}
