// Pip acting out your answers while a form is up: a little diorama under a glass cloche on the writing slope's
// shelf (a daybed with pillows, sheep hopping a fence, a sunrise over a hill, a phone tucked into a drawer, a mug
// steaming, a radio, a gramophone, a pillow tower that grows with your hours of sleep...), Pip's mood and
// gestures, the light through the window turning to another hour, a sound to set the scene.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import { loadGLB } from '../gfx/glb.ts';
import type { OwlAction, OwlMood } from '../owl/actor.ts';
import { SPR } from '../world/fx.ts';
import { DESK_TOP } from './furnish.ts';
import { at, Batch, bbox, cyl, lathe, mat } from './kit.ts';
import type { Office } from './office.ts';
import { SLOPE } from './desk.ts';

interface Scene { mood?: OwlMood; act?: OwlAction; hour?: number | null; snd?: string; loop?: string; level?: number; prop?: string; mode?: string; spin?: boolean }

const S: Record<string, Scene> = {
  'goals:sleep_better': { mood: 'love', act: 'yawn', prop: 'bed' },
  'goals:fall_asleep': { mood: 'sleepy', act: 'nod', prop: 'sheep' },
  'goals:wake_refreshed': { mood: 'happy', act: 'stretch', hour: 7.2, snd: 'bird_chirp', prop: 'sunrise' },
  'goals:steady_routine': { mood: 'proud', act: 'nod', snd: 'clock_wind', spin: true, prop: 'alarm' },
  'goals:less_phone': { mood: 'proud', act: 'nod', prop: 'phone', mode: 'drawer' },
  'goals:track_sounds': { mood: 'curious', prop: 'mic' },
  'latency:quick': { mood: 'love', act: 'yawn', prop: 'bed' },
  'latency:normal': { mood: 'sleepy', act: 'yawn', prop: 'bed' },
  'latency:slow': { mood: 'sleepy', prop: 'sheep' },
  'latency:long': { mood: 'worried', snd: 'clock_tick', prop: 'alarm', spin: true },
  'phone:never': { mood: 'love', act: 'dance', prop: 'phone', mode: 'drawer' },
  'phone:sometimes': { mood: 'curious', prop: 'phone', mode: 'buzz' },
  'phone:nightly': { mood: 'dizzy', hour: 23.5, prop: 'phone', mode: 'glow' },
  'chrono:lark': { mood: 'happy', act: 'stretch', hour: 6.8, snd: 'bird_chirp', prop: 'sunrise' },
  'chrono:between': { mood: 'calm', act: 'nod', hour: 13, prop: 'sunrise', mode: 'noon' },
  'chrono:owl': { mood: 'excited', act: 'dance', hour: 23.5, snd: 'owl_hoot', prop: 'moon' },
  'caffeine:none': { mood: 'calm', prop: 'milk' },
  'caffeine:morning': { mood: 'happy', hour: 8, prop: 'mug', mode: 'day' },
  'caffeine:late': { mood: 'dizzy', act: 'shiver', hour: 22.5, prop: 'mug', mode: 'night' },
  'mic:yes': { mood: 'curious', act: 'nod', prop: 'mic' },
  'mic:no': { mood: 'happy', act: 'nod' },
  'hours:tower': { mood: 'happy', prop: 'pillows' },
  'relax:rain': { mood: 'calm', loop: 'amb_rain', prop: 'rain' },
  'relax:waves': { mood: 'calm', loop: 'amb_waves', hour: 17.6, prop: 'waves' },
  'relax:forest': { mood: 'calm', loop: 'amb_forest_night', hour: 22, prop: 'moon' },
  'relax:fire': { mood: 'calm', loop: 'amb_fire', prop: 'stove' },
  'relax:stream': { mood: 'calm', loop: 'amb_stream', hour: 10, prop: 'waves', mode: 'stream' },
  'relax:wind': { mood: 'calm', loop: 'amb_wind', hour: 15, prop: 'sunrise', mode: 'noon' },
  'relax:brown': { mood: 'calm', loop: 'amb_brown', level: 0.4, prop: 'radio' },
  'relax:lullaby': { mood: 'love', act: 'dance', loop: 'music_lullaby', prop: 'gramophone' },
  'relax:night': { mood: 'calm', loop: 'amb_night', hour: 23.5, prop: 'moon' },
  'relax:breathing': { mood: 'calm', snd: 'breath_in', prop: 'bed' },
  'relax:reading': { mood: 'calm', snd: 'page_turn', prop: 'book' },
};

export interface Dioramas { show(id: string | null): void; param(v: number): void; readonly at: THREE.Vector3 }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** where the vitrine stands: the left end of the writing slope's shelf */
const BASE = V(-0.105, DESK_TOP + SLOPE.front + SLOPE.run * Math.tan(SLOPE.angle) + 0.004, SLOPE.z - SLOPE.run - SLOPE.shelf / 2);
const R = 0.042, H = 0.074;

type Prop = { group: THREE.Object3D; tick?: (t: number, dt: number) => void; set?: (v: number) => void; dispose?: () => void };

export function dioramas(office: Office): Dioramas {
  const m = office.mats;
  // the vitrine: a turned walnut base with green felt, a glass cloche with a brass knob
  const root = new THREE.Group();
  root.position.copy(BASE);
  const b = new Batch();
  b.add(m.walnut, lathe([[0, 0], [R + 0.006, 0], [R + 0.007, 0.004], [R + 0.004, 0.008], [0, 0.008]], 28));
  b.add(m.brass, at(cyl(R + 0.0045, 0.0015, 28), 0, 0.0075, 0));
  b.add(m.felt, at(cyl(R, 0.001, 28), 0, 0.008, 0));
  root.add(b.build('vitrine'));
  const glass = new THREE.Mesh(lathe([[R - 0.001, 0], [R, 0.004], [R - 0.001, H * 0.65], [R * 0.82, H * 0.88], [R * 0.45, H * 0.99], [0.006, H], [0.0001, H]], 28), m.glass);
  glass.position.y = 0.009; glass.renderOrder = 4;
  const knob = new THREE.Mesh(lathe([[0, 0], [0.006, 0], [0.007, 0.006], [0.004, 0.01], [0, 0.011]], 12), m.brass);
  knob.position.y = 0.009 + H;
  root.add(glass, knob);
  const stage = new THREE.Group();
  stage.position.y = 0.009;
  root.add(stage);
  office.room.add(root);

  // borrowed props (one packed GLB)
  const glb = new Map<string, THREE.Object3D>();
  void loadGLB('interview/props.glb').then((g) => {
    for (const id of ['daybed', 'radio', 'gramophone', 'teapot']) {
      const n = g.scene.getObjectByName(id);
      if (!n) continue;
      n.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm && 'roughness' in mm) { mm.roughness = 0.7; mm.metalness = 0; } });
      glb.set(id, n);
    }
  }).catch((e) => console.warn('diorama props failed', e));
  /** a borrowed model, fitted into a w-metre footprint, standing on the felt */
  const fit = (id: string, w: number): THREE.Group => {
    const src = glb.get(id);
    const g = new THREE.Group();
    if (!src) return g;
    const c = src.clone(true);
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c), sz = box.getSize(V(0, 0, 0));
    const k = w / Math.max(sz.x, sz.z, 0.0001);
    c.scale.setScalar(k);
    c.position.set(-(box.min.x + sz.x / 2) * k, -box.min.y * k, -(box.min.z + sz.z / 2) * k);
    c.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    g.add(c);
    return g;
  };
  const M = {
    wool: mat({ color: 0xf2ece0, roughness: 1 }), face: mat({ color: 0x2a2220, roughness: 0.9 }), white: mat({ color: 0xfbf8f2, roughness: 0.6 }),
    pillow: mat({ color: 0xf6efe2, roughness: 0.95 }), pink: mat({ color: 0xf0c6c0, roughness: 0.95 }), blue: mat({ color: 0xc8dcea, roughness: 0.95 }),
    hill: mat({ color: 0x4f8a3a, roughness: 1 }), sun: new THREE.MeshBasicMaterial({ color: 0xffc860, toneMapped: false }), moon: new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false }),
    sky: mat({ color: 0x1b2d5c, roughness: 1 }), screen: new THREE.MeshBasicMaterial({ color: 0x9fd0ff, toneMapped: false }), dark: mat({ color: 0x1a1a1e, roughness: 0.3, metalness: 0.2 }),
    mugDay: mat({ color: 0xf1e6cf, roughness: 0.25 }), mugNight: mat({ color: 0x24305e, roughness: 0.25 }), coffee: mat({ color: 0x3a2214, roughness: 0.15 }),
    water: mat({ color: 0x3a78a8, roughness: 0.1 }), iron: mat({ color: 0x2b2826, roughness: 0.7, metalness: 0.4 }), flame: new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false }),
    page: mat({ color: 0xf5eedb, roughness: 0.9 }), cover: mat({ color: 0x6a1a14, roughness: 0.7 }),
  };
  const ball = (r: number, mt: THREE.Material, x: number, y: number, z: number, d = 1) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, d), mt); s.position.set(x, y, z); s.castShadow = true; return s; };

  const make: Record<string, (mode?: string) => Prop> = {
    bed: () => {
      const g = fit('daybed', 0.074);
      const p1 = new THREE.Mesh(bbox(0.016, 0.007, 0.011, { r: 0.0035 }), M.pillow); p1.position.set(-0.024, 0.026, 0.002); p1.rotation.z = 0.3;
      const p2 = new THREE.Mesh(bbox(0.013, 0.006, 0.01, { r: 0.003 }), M.pink); p2.position.set(-0.018, 0.025, -0.006); p2.rotation.set(0.1, 0.4, 0.2);
      g.add(p1, p2);
      let z = 0.5;
      return { group: g, tick: (_t, dt) => { if ((z -= dt) <= 0) { z = 1.6; const w = root.localToWorld(V(-0.01, 0.05, 0)); office.burst('zzz', w, 2, 0.3); } } };
    },
    sheep: () => {
      const g = new THREE.Group();
      const fb = new Batch();
      for (const x of [-0.004, 0.004]) fb.add(m.oak, at(bbox(0.003, 0.02, 0.003, { r: 0.0006 }), x, 0, -0.012), at(bbox(0.003, 0.02, 0.003, { r: 0.0006 }), x, 0, 0.012));
      fb.add(m.oak, at(bbox(0.011, 0.0025, 0.03, { r: 0.0006 }), 0, 0.009, 0), at(bbox(0.011, 0.0025, 0.03, { r: 0.0006 }), 0, 0.015, 0));
      g.add(fb.build('fence'));
      const sheep: THREE.Group[] = [];
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Group();
        for (const [x, y, z, r] of [[0, 0.009, 0, 0.0065], [0.005, 0.01, 0.002, 0.005], [-0.005, 0.01, -0.002, 0.005], [0.002, 0.013, -0.002, 0.005], [-0.002, 0.012, 0.003, 0.005]] as number[][]) s.add(ball(r, M.wool, x, y, z));
        s.add(ball(0.0035, M.face, 0.01, 0.012, 0));
        for (const [x, z] of [[0.004, 0.003], [0.004, -0.003], [-0.004, 0.003], [-0.004, -0.003]]) { const l = new THREE.Mesh(cyl(0.0008, 0.005, 5), M.face); l.position.set(x, 0, z); s.add(l); }
        g.add(s); sheep.push(s);
      }
      let last = -1;
      return { group: g, tick: (t) => {
        sheep.forEach((s, i) => {
          const ph = (t / 3.2 + i / 3) % 1, x = -0.032 + ph * 0.064;
          const near = Math.max(0, 1 - Math.abs(x) / 0.014);
          s.position.set(x, Math.sin((near * Math.PI) / 2) ** 0.8 * 0.02, (i - 1) * 0.006);
          s.rotation.z = Math.abs(x) < 0.014 ? -x * 12 : 0;
          s.scale.setScalar(Math.max(0.001, Math.min(1, ph * 10, (1 - ph) * 10)));
          const cyc = Math.floor(t / 3.2 + i / 3);
          if (x > 0 && last !== cyc * 3 + i) { last = cyc * 3 + i; try { sound.play('pet_jump', { volume: 0.18, rate: 1.4, gap: 300 }); } catch { /* */ } }
        });
      } };
    },
    sunrise: (mode) => {
      const g = new THREE.Group();
      const hill = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hill);
      hill.scale.set(1.2, 0.5, 0.6); hill.position.set(0, 0, 0.006);
      const sun = new THREE.Mesh(new THREE.CircleGeometry(0.011, 20), M.sun);
      sun.position.set(0.004, 0.0, -0.012);
      const rays = new THREE.Group();
      for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.0015, 0.006), M.sun); r.position.set(Math.sin((i / 8) * Math.PI * 2) * 0.016, Math.cos((i / 8) * Math.PI * 2) * 0.016, 0); r.rotation.z = -(i / 8) * Math.PI * 2; rays.add(r); }
      sun.add(rays);
      g.add(hill, sun);
      const top = mode === 'noon' ? 0.05 : 0.038;
      return { group: g, tick: (t, dt) => { sun.position.y += (top - sun.position.y) * Math.min(1, dt * 1.2); rays.rotation.z = t * 0.6; } };
    },
    moon: () => {
      const g = new THREE.Group();
      const sh = new THREE.Shape(); sh.absarc(0, 0, 0.014, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(0.007, 0.004, 0.012, 0, Math.PI * 2, true); sh.holes.push(hole);
      const moon = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false, curveSegments: 16 }), M.moon);
      moon.position.set(-0.006, 0.042, 0);
      const wire = new THREE.Mesh(cyl(0.0004, 0.03, 4), m.brass); wire.position.set(-0.006, 0.0, 0);
      g.add(moon, wire);
      const stars: THREE.Mesh[] = [];
      for (const [x, y] of [[0.018, 0.05], [0.026, 0.034], [-0.026, 0.028], [0.012, 0.024]]) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.003), M.moon); s.position.set(x, y, 0); const w = new THREE.Mesh(cyl(0.0003, y, 3), m.brass); w.position.set(x, 0, 0); g.add(s, w); stars.push(s); }
      return { group: g, tick: (t) => { moon.rotation.z = Math.sin(t * 0.8) * 0.15; stars.forEach((s, i) => { s.rotation.y = t * 2 + i; s.scale.setScalar(0.8 + Math.sin(t * 3 + i * 2) * 0.25); }); } };
    },
    phone: (mode) => {
      const g = new THREE.Group();
      const phone = new THREE.Group();
      const body = new THREE.Mesh(bbox(0.014, 0.0025, 0.026, { r: 0.0012 }), M.dark);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.022), M.screen); scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0026;
      phone.add(body, scr);
      g.add(phone);
      if (mode === 'drawer') {
        const box = new Batch();
        box.add(m.oak, at(bbox(0.04, 0.02, 0.034, { r: 0.002 }), 0, 0, -0.004));
        const drawer = new THREE.Group();
        const db = new Batch(); db.add(m.walnut, at(bbox(0.034, 0.012, 0.03, { r: 0.0015 }), 0, 0.004, 0)); db.add(m.brass, at(bbox(0.008, 0.002, 0.002, { r: 0.0008 }), 0, 0.011, 0.016));
        drawer.add(db.build('drawer'));
        g.add(box.build('cabinet'), drawer);
        phone.position.set(0, 0.03, 0.02);
        return { group: g, tick: (t) => {
          const k = (t % 4) / 4;
          drawer.position.z = k < 0.15 ? (k / 0.15) * 0.022 : k < 0.6 ? 0.022 : k < 0.75 ? (1 - (k - 0.6) / 0.15) * 0.022 : 0;
          phone.position.set(0, k < 0.2 ? 0.032 : k < 0.45 ? 0.032 - ((k - 0.2) / 0.25) * 0.02 : 0.012, drawer.position.z);
          phone.visible = k < 0.8;
        } };
      }
      phone.rotation.x = mode === 'glow' ? -1.1 : 0;
      phone.position.set(0, mode === 'glow' ? 0.02 : 0, 0);
      let ping = 0.5;
      return { group: g, tick: (t, dt) => {
        if (mode === 'buzz') { const buzz = (t % 1.6) < 0.35 ? Math.sin(t * 90) * 0.06 : 0; phone.rotation.y = buzz; if ((ping -= dt) <= 0) { ping = 1.6; try { sound.play('notify_message', { volume: 0.22, gap: 800 }); } catch { /* */ } } }
        else { (M.screen as THREE.MeshBasicMaterial).color.setHSL(0.58, 0.8, 0.6 + Math.sin(t * 7) * 0.08); }
      } };
    },
    mic: () => {
      const g = new THREE.Group();
      const bb = new Batch();
      bb.add(m.chrome, lathe([[0, 0], [0.012, 0], [0.012, 0.002], [0, 0.003]], 16));
      bb.add(m.chrome, at(cyl(0.0012, 0.026, 6), 0, 0.002, 0));
      g.add(bb.build('mic'));
      const head = ball(0.007, m.chrome, 0, 0.032, 0, 2); head.scale.y = 1.3;
      g.add(head);
      let w = 0;
      return { group: g, tick: (_t, dt) => { if ((w -= dt) <= 0) { w = 0.45; const p = root.localToWorld(V(0, 0.05, 0)); office.fx.emit({ x: p.x, y: p.y, z: p.z, life: 0.9, frame: SPR.ring, color: 0xbfe6ff, size: 0.012, grow: 3, fadeOut: 0.5, add: true }); } } };
    },
    milk: () => {
      const g = fit('teapot', 0.03);
      g.position.x = 0.012;
      const bottle = new THREE.Mesh(lathe([[0, 0], [0.007, 0], [0.0075, 0.016], [0.004, 0.024], [0.004, 0.028], [0, 0.028]], 14), M.white);
      bottle.position.set(-0.016, 0, 0.004); bottle.castShadow = true;
      const w = new THREE.Group(); w.add(g, bottle);
      return { group: w };
    },
    mug: (mode) => {
      const g = new THREE.Group();
      const mt = mode === 'night' ? M.mugNight : M.mugDay;
      const mug = new THREE.Mesh(lathe([[0, 0], [0.01, 0], [0.011, 0.002], [0.011, 0.022], [0.0095, 0.022], [0.0095, 0.003], [0, 0.003]], 18), mt);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0017, 6, 12, Math.PI * 1.2), mt);
      handle.position.set(0.011, 0.012, 0); handle.rotation.z = -Math.PI * 0.6;
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0094, 16), M.coffee); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.019;
      g.add(mug, handle, coffee);
      g.traverse((o) => { o.castShadow = true; });
      let s = 0;
      return { group: g, tick: (_t, dt) => { if ((s -= dt) <= 0) { s = 0.35; const p = root.localToWorld(V((Math.random() - 0.5) * 0.008, 0.03, 0)); office.fx.emit({ x: p.x, y: p.y, z: p.z, vy: 0.03, life: 1.4, frame: SPR.puff1, frames: 3, fps: 2, color: 0xf6f1e6, size: 0.012, grow: 1.2, fadeIn: 0.3, fadeOut: 0.8, flutter: 0.01 }); } } };
    },
    pillows: () => {
      const g = new THREE.Group();
      const stack: THREE.Mesh[] = [];
      const mats = [M.pillow, M.pink, M.blue, M.pillow, mat({ color: 0xf5e2b4, roughness: 0.95 })];
      const set = (n: number) => {
        n = Math.max(4, Math.min(12, Math.round(n)));
        while (stack.length > n) { const p = stack.pop()!; g.remove(p); }
        while (stack.length < n) {
          const i = stack.length;
          const p = new THREE.Mesh(bbox(0.03, 0.0048, 0.022, { r: 0.0022 }), mats[i % mats.length]);
          p.position.set(Math.sin(i * 2.3) * 0.002, i * 0.0052, Math.cos(i * 1.7) * 0.0015);
          p.rotation.y = Math.sin(i * 1.3) * 0.25;
          p.castShadow = true;
          p.scale.setScalar(0.001);
          g.add(p); stack.push(p);
          try { sound.play('fabric', { volume: 0.25, rate: 1 + i * 0.05, gap: 60 }); } catch { /* */ }
        }
      };
      return { group: g, set, tick: (_t, dt) => { for (const p of stack) p.scale.setScalar(Math.min(1, p.scale.x + dt * 6)); } };
    },
    rain: () => {
      const g = new THREE.Group();
      const cloud = new THREE.Group();
      for (const [x, y, r] of [[0, 0.05, 0.01], [0.009, 0.048, 0.008], [-0.009, 0.048, 0.008], [0.003, 0.056, 0.008]]) cloud.add(ball(r, mat({ color: 0xc8ccd4, roughness: 1 }), x, y, 0));
      const umb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat({ color: 0xb02a2a, roughness: 0.6, side: THREE.DoubleSide }));
      umb.position.y = 0.022;
      const stick = new THREE.Mesh(cyl(0.0007, 0.022, 4), m.walnut);
      g.add(cloud, umb, stick);
      let d = 0;
      return { group: g, tick: (_t, dt) => { if ((d -= dt) <= 0) { d = 0.06; const p = root.localToWorld(V((Math.random() - 0.5) * 0.03, 0.042, (Math.random() - 0.5) * 0.02)); office.fx.emit({ x: p.x, y: p.y, z: p.z, vy: -0.12, life: 0.35, frame: SPR.mote, color: 0xa8d0f0, size: 0.004, fadeOut: 0.1 }); } } };
    },
    waves: (mode) => {
      const g = new THREE.Group();
      const geo = new THREE.PlaneGeometry(0.07, 0.05, 24, 12); geo.rotateX(-Math.PI / 2);
      const sea = new THREE.Mesh(geo, M.water);
      sea.position.y = 0.004;
      const sand = new THREE.Mesh(bbox(0.07, 0.003, 0.016, { r: 0.001 }), mat({ color: mode === 'stream' ? 0x5c7a3a : 0xd8c08a, roughness: 1 }));
      sand.position.z = 0.02;
      g.add(sea, sand);
      const base = Float32Array.from(geo.attributes.position.array as Float32Array);
      return { group: g, tick: (t) => {
        const p = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) p.setY(i, base[i * 3 + 1] + Math.sin(base[i * 3] * 180 + t * 3) * 0.0012 + Math.sin(base[i * 3 + 2] * 140 + t * 2) * 0.0008);
        p.needsUpdate = true; geo.computeVertexNormals();
      } };
    },
    stove: () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(lathe([[0, 0], [0.012, 0], [0.015, 0.008], [0.016, 0.02], [0.012, 0.03], [0.004, 0.034], [0.004, 0.06], [0, 0.06]], 16), M.iron);
      body.castShadow = true;
      const fire = new THREE.Group();
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.009, 5), M.flame); f.position.set((i - 1) * 0.003, 0.012, 0.014); fire.add(f); }
      g.add(body, fire);
      return { group: g, tick: (t) => { fire.children.forEach((f, i) => { f.scale.set(1, 0.8 + Math.sin(t * 13 + i * 2) * 0.3, 1); }); } };
    },
    radio: () => ({ group: fit('radio', 0.05) }),
    gramophone: () => {
      const g = fit('gramophone', 0.05);
      let n = 0;
      return { group: g, tick: (_t, dt) => { if ((n -= dt) <= 0) { n = 0.9; const p = root.localToWorld(V(0, 0.06, 0)); office.burst('notes', p, 1, 0.35); } } };
    },
    book: () => {
      const g = new THREE.Group();
      const bb = new Batch();
      bb.add(M.cover, at(bbox(0.024, 0.002, 0.03, { r: 0.0005 }), -0.012, 0, 0, 0, 0, 0.12), at(bbox(0.024, 0.002, 0.03, { r: 0.0005 }), 0.012, 0, 0, 0, 0, -0.12));
      bb.add(M.page, at(bbox(0.022, 0.003, 0.028, { r: 0.0005 }), -0.011, 0.002, 0, 0, 0, 0.12), at(bbox(0.022, 0.003, 0.028, { r: 0.0005 }), 0.011, 0.002, 0, 0, 0, -0.12));
      g.add(bb.build('book'));
      return { group: g };
    },
    alarm: () => {
      const g = new THREE.Group();
      const bb = new Batch();
      bb.add(m.brass, at(cyl(0.012, 0.006, 20), 0, 0.014, 0, Math.PI / 2, 0, 0));
      for (const sx of [-1, 1]) bb.add(m.brass, at(new THREE.SphereGeometry(0.005, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sx * 0.008, 0.024, -0.003, 0, 0, sx * -0.5));
      for (const sx of [-1, 1]) bb.add(m.brass, at(cyl(0.001, 0.008, 4), sx * 0.007, 0, -0.002, 0, 0, sx * 0.3));
      g.add(bb.build('alarm'));
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 20), M.white); face.position.set(0, 0.014, 0.0032);
      const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.0012, 0.009), M.face); hand.geometry.translate(0, 0.0045, 0); hand.position.set(0, 0.014, 0.0035);
      g.add(face, hand);
      return { group: g, tick: (t) => { hand.rotation.z = -t * 6; g.rotation.z = Math.sin(t * 40) * 0.03; } };
    },
  };

  let cur: { id: string; prop: Prop | null; born: number } | null = null;
  const leaving: { prop: Prop; t: number }[] = [];
  let stopLoop: (() => void) | null = null;
  let t = 0;
  office.tickers.add((dt) => {
    t += dt;
    if (cur?.prop) {
      const k = Math.min(1, (t - cur.born) / 0.35), s = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.18 : 1;
      cur.prop.group.scale.set(s * Math.max(0.001, k), Math.max(0.001, k) / Math.max(0.6, s), s * Math.max(0.001, k));
      cur.prop.tick?.(t, dt);
    }
    for (const l of [...leaving]) {
      l.t += dt;
      const k = 1 - l.t / 0.25;
      if (k <= 0) { stage.remove(l.prop.group); l.prop.dispose?.(); leaving.splice(leaving.indexOf(l), 1); continue; }
      l.prop.group.scale.setScalar(Math.max(0.001, k));
    }
    stage.rotation.y = Math.sin(t * 0.4) * 0.25;
  });
  const loop = (id: string, level = 0.5) => { void sound.loop(id, true, level, 'amb', 0.6); return () => void sound.loop(id, false, level, 'amb', 0.8); };

  return {
    at: BASE.clone().add(V(0, 0.04, 0)),
    show(id) {
      if (id === (cur?.id ?? null)) return;
      stopLoop?.(); stopLoop = null;
      if (cur?.prop) leaving.push({ prop: cur.prop, t: 0 });
      const sc = id ? S[id] : null;
      if (!id || !sc) { cur = null; office.window(null); return; }
      let prop: Prop | null = null;
      if (sc.prop && make[sc.prop]) {
        prop = make[sc.prop](sc.mode);
        prop.group.scale.setScalar(0.001);
        stage.add(prop.group);
        try { sound.play('pop_puff', { volume: 0.3, rate: 1.3, gap: 80 }); } catch { /* */ }
        const p = root.localToWorld(V(0, 0.02, 0));
        office.burst('sparkle', p, 4, 0.3);
      }
      cur = { id, prop, born: t };
      if (sc.mood) office.pip.setMood(sc.mood, 2.5);
      if (sc.act) office.pip.play(sc.act);
      office.window(sc.hour ?? null, id.startsWith('relax:rain') ? 'rain' : 'clear');
      if (sc.snd) try { sound.play(sc.snd, { volume: 0.45, gap: 200 }); } catch { /* */ }
      if (sc.loop) stopLoop = loop(sc.loop, sc.level ?? 0.5);
      if (sc.spin) office.clock.spin += 3;
      office.pip.lookAt = root.localToWorld(V(0, 0.04, 0));
    },
    param(v) { cur?.prop?.set?.(v); },
  };
}
